import cors from "cors";
import express from "express";
import http from "http";
import bcrypt from "bcrypt";
import { z } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { config } from "./config.js";
import { prisma } from "./prisma.js";
import { AVATAR_OPTIONS } from "./constants.js";
import { AuthedRequest, requireAuth, signToken } from "./auth.js";
import { getIo, initRealtime } from "./realtime.js";
import { haversineMeters, toCanonicalFriendPair } from "./utils.js";

const app = express();
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());

const nudgeRateMap = new Map<string, number[]>();

function parseVibeTags(input: string) {
  return input.split(",").map((tag) => tag.trim()).filter(Boolean);
}

async function getFriendIds(userId: string) {
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true }
  });

  return rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId));
}

async function assertFriends(userId: string, otherId: string) {
  const pair = toCanonicalFriendPair(userId, otherId);
  const friendship = await prisma.friendship.findUnique({
    where: {
      userAId_userBId: pair
    }
  });
  return Boolean(friendship);
}

function emitToUsers(userIds: string[], event: string, payload: unknown) {
  const io = getIo();
  userIds.forEach((id) => io.to(id).emit(event, payload));
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/signup", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    include: { profile: true }
  });

  const token = signToken({ userId: user.id });
  return res.status(201).json({ token, userId: user.id, needsOnboarding: !user.profile });
});

app.post("/auth/signin", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ userId: user.id });
  return res.json({ token, userId: user.id, needsOnboarding: !user.profile });
});

app.get("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  return res.json({
    userId,
    profile: user.profile,
    needsOnboarding: !user.profile
  });
});

app.post("/profiles", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    username: z.string().trim().min(3).regex(/^[a-zA-Z0-9_]+$/),
    displayName: z.string().trim().min(1).max(50),
    avatar: z.enum(AVATAR_OPTIONS),
    premium: z.boolean().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.auth!.userId;
  const existingProfile = await prisma.profile.findUnique({ where: { userId } });
  if (existingProfile) return res.status(409).json({ error: "Profile already exists" });

  try {
    const profile = await prisma.profile.create({
      data: {
        userId,
        username: parsed.data.username.toLowerCase(),
        displayName: parsed.data.displayName,
        avatar: parsed.data.avatar,
        premium: parsed.data.premium ?? false
      }
    });

    return res.status(201).json(profile);
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "Username already taken" });
    }
    throw err;
  }
});

app.patch("/profiles/me", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    displayName: z.string().trim().min(1).max(50).optional(),
    avatar: z.enum(AVATAR_OPTIONS).optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const profile = await prisma.profile.update({
    where: { userId: req.auth!.userId },
    data: parsed.data
  });

  return res.json(profile);
});

app.get("/bars", requireAuth, async (_req, res) => {
  const bars = await prisma.bar.findMany({ orderBy: { name: "asc" } });
  return res.json(
    bars.map((bar) => ({
      ...bar,
      vibeTags: parseVibeTags(bar.vibeTags)
    }))
  );
});

app.get("/billing/plans", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const currentTier = profile?.premium ? "PREMIUM" : "FREE";

  return res.json({
    currentTier,
    plans: [
      {
        id: "FREE",
        name: "Free",
        monthlyPrice: 0,
        features: ["Core check-ins", "Friends + messaging", "Map visibility"]
      },
      {
        id: "PREMIUM",
        name: "Premium",
        monthlyPrice: 4.99,
        features: ["Premium icon pack", "Priority nudge delivery", "Early feature access"]
      },
      {
        id: "VIP",
        name: "VIP",
        monthlyPrice: 9.99,
        features: ["VIP icon pack", "VIP profile flair", "Future concierge features"]
      }
    ]
  });
});

app.post("/billing/checkout-session", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ planId: z.enum(["PREMIUM", "VIP"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.auth!.userId;
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const currentTier = profile?.premium ? "PREMIUM" : "FREE";
  if (currentTier === parsed.data.planId) {
    return res.status(409).json({ error: "Plan already active" });
  }

  const sessionId = `stub_${parsed.data.planId.toLowerCase()}_${Date.now()}`;
  return res.status(201).json({
    sessionId,
    status: "STUB_READY",
    planId: parsed.data.planId,
    checkoutUrl: `${config.clientOrigin}/settings?billing=${sessionId}`
  });
});

app.get("/friends/search", requireAuth, async (req: AuthedRequest, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (q.length < 2) return res.json([]);

  const me = req.auth!.userId;
  const results = await prisma.profile.findMany({
    where: {
      username: { contains: q },
      NOT: { userId: me }
    },
    select: {
      userId: true,
      username: true,
      displayName: true,
      avatar: true,
      premium: true
    },
    take: 20
  });

  return res.json(results);
});

app.post("/friends/requests", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ toUserId: z.string().cuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const fromUserId = req.auth!.userId;
  const toUserId = parsed.data.toUserId;
  if (fromUserId === toUserId) return res.status(400).json({ error: "Cannot friend yourself" });

  const alreadyFriends = await assertFriends(fromUserId, toUserId);
  if (alreadyFriends) return res.status(409).json({ error: "Already friends" });

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { fromUserId, toUserId, status: "PENDING" },
        { fromUserId: toUserId, toUserId: fromUserId, status: "PENDING" }
      ]
    }
  });

  if (existing) return res.status(409).json({ error: "Request already pending" });

  const request = await prisma.friendRequest.create({
    data: { fromUserId, toUserId }
  });

  emitToUsers([toUserId], "friend:request", { fromUserId, requestId: request.id });
  return res.status(201).json(request);
});

app.get("/friends/requests", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const incoming = await prisma.friendRequest.findMany({
    where: { toUserId: userId, status: "PENDING" },
    include: { fromUser: { include: { profile: true } } },
    orderBy: { createdAt: "desc" }
  });

  return res.json(
    incoming.map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      createdAt: r.createdAt,
      profile: r.fromUser.profile
    }))
  );
});

app.post("/friends/requests/:id/respond", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ action: z.enum(["ACCEPT", "DECLINE"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const requestId = String(req.params.id);
  const userId = req.auth!.userId;

  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.toUserId !== userId) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "PENDING") return res.status(409).json({ error: "Already handled" });

  const action = parsed.data.action;

  await prisma.$transaction(async (tx) => {
    await tx.friendRequest.update({
      where: { id: requestId },
      data: { status: action, respondedAt: new Date() }
    });

    if (action === "ACCEPT") {
      const pair = toCanonicalFriendPair(request.fromUserId, request.toUserId);
      await tx.friendship.create({ data: pair });
    }
  });

  if (action === "ACCEPT") {
    emitToUsers([request.fromUserId, request.toUserId], "friend:accepted", {
      userAId: request.fromUserId,
      userBId: request.toUserId
    });
  }

  return res.json({ ok: true });
});

app.get("/friends", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const friendIds = await getFriendIds(userId);

  const [profiles, checkIns] = await Promise.all([
    prisma.profile.findMany({
      where: { userId: { in: friendIds } },
      select: {
        userId: true,
        username: true,
        displayName: true,
        avatar: true,
        premium: true
      }
    }),
    prisma.checkIn.findMany({
      where: { userId: { in: friendIds } },
      include: { bar: true }
    })
  ]);

  const checkInMap = new Map<
    string,
    { barId: string; barName: string; updatedAt: Date }
  >(
    checkIns.map((c) => [
      c.userId,
      {
        barId: c.barId,
        barName: c.bar.name,
        updatedAt: c.updatedAt
      }
    ])
  );

  const data = profiles
    .map((profile) => ({
      ...profile,
      checkIn: checkInMap.get(profile.userId)
        ? {
            barId: checkInMap.get(profile.userId)!.barId,
            barName: checkInMap.get(profile.userId)!.barName,
            updatedAt: checkInMap.get(profile.userId)!.updatedAt
          }
        : null
    }))
    .sort((a, b) => {
      if (a.checkIn && !b.checkIn) return -1;
      if (!a.checkIn && b.checkIn) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

  return res.json(data);
});

app.get("/map/overview", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const friendIds = await getFriendIds(userId);

  const [bars, friendProfiles, friendCheckIns, selfCheckIn] = await Promise.all([
    prisma.bar.findMany({ orderBy: { name: "asc" } }),
    prisma.profile.findMany({
      where: { userId: { in: friendIds } },
      select: { userId: true, displayName: true, username: true, avatar: true }
    }),
    prisma.checkIn.findMany({
      where: { userId: { in: friendIds } },
      include: { bar: true }
    }),
    prisma.checkIn.findUnique({ where: { userId }, include: { bar: true } })
  ]);

  const byBar: Record<string, Array<{ userId: string; displayName: string; username: string; avatar: string }>> = {};
  const profileMap = new Map<
    string,
    { userId: string; displayName: string; username: string; avatar: string }
  >(friendProfiles.map((p) => [p.userId, p]));

  friendCheckIns.forEach((checkIn) => {
    const profile = profileMap.get(checkIn.userId);
    if (!profile) return;
    byBar[checkIn.barId] = byBar[checkIn.barId] ?? [];
    byBar[checkIn.barId].push(profile);
  });

  return res.json({
    bars: bars.map((bar) => ({
      ...bar,
      vibeTags: parseVibeTags(bar.vibeTags),
      friendsHere: byBar[bar.id] ?? []
    })),
    selfCheckIn: selfCheckIn
      ? {
          barId: selfCheckIn.barId,
          barName: selfCheckIn.bar.name,
          method: selfCheckIn.method,
          updatedAt: selfCheckIn.updatedAt
        }
      : null
  });
});

app.post("/checkins/manual", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ barId: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.auth!.userId;
  const bar = await prisma.bar.findUnique({ where: { id: parsed.data.barId } });
  if (!bar) return res.status(404).json({ error: "Bar not found" });

  const checkIn = await prisma.checkIn.upsert({
    where: { userId },
    update: { barId: bar.id, method: "MANUAL" },
    create: { userId, barId: bar.id, method: "MANUAL" },
    include: { bar: true }
  });

  const friendIds = await getFriendIds(userId);
  emitToUsers([...friendIds, userId], "checkin:update", {
    userId,
    action: "CHECKED_IN",
    bar: {
      id: bar.id,
      name: bar.name,
      latitude: bar.latitude,
      longitude: bar.longitude
    },
    at: checkIn.updatedAt
  });

  return res.json({ ok: true, checkIn });
});

app.post("/checkins/auto", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.auth!.userId;
  const { latitude, longitude, accuracy } = parsed.data;

  if (accuracy && accuracy > 90) {
    return res.json({ status: "LOW_ACCURACY", checkIn: null });
  }

  const distanceToCenter = haversineMeters(
    latitude,
    longitude,
    config.downtownCenter.lat,
    config.downtownCenter.lng
  );

  if (distanceToCenter > config.downtownCenter.radiusMeters) {
    await prisma.checkIn.deleteMany({ where: { userId } });
    const friendIds = await getFriendIds(userId);
    emitToUsers([...friendIds, userId], "checkin:update", {
      userId,
      action: "CHECKED_OUT",
      at: new Date().toISOString()
    });
    return res.json({ status: "OUTSIDE_DOWNTOWN", checkIn: null });
  }

  const bars = await prisma.bar.findMany();
  let nearest: (typeof bars)[number] | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const bar of bars) {
    const d = haversineMeters(latitude, longitude, bar.latitude, bar.longitude);
    if (d < nearestDistance) {
      nearest = bar;
      nearestDistance = d;
    }
  }

  if (!nearest || nearestDistance > config.autoCheckInRadiusMeters) {
    const existing = await prisma.checkIn.findUnique({ where: { userId } });
    await prisma.checkIn.deleteMany({ where: { userId } });
    if (existing) {
      const friendIds = await getFriendIds(userId);
      emitToUsers([...friendIds, userId], "checkin:update", {
        userId,
        action: "CHECKED_OUT",
        at: new Date().toISOString()
      });
    }
    return res.json({ status: "NO_BAR_IN_RANGE", checkIn: null });
  }

  const checkIn = await prisma.checkIn.upsert({
    where: { userId },
    update: { barId: nearest.id, method: "AUTO" },
    create: { userId, barId: nearest.id, method: "AUTO" },
    include: { bar: true }
  });

  const friendIds = await getFriendIds(userId);
  emitToUsers([...friendIds, userId], "checkin:update", {
    userId,
    action: "CHECKED_IN",
    bar: {
      id: nearest.id,
      name: nearest.name,
      latitude: nearest.latitude,
      longitude: nearest.longitude
    },
    at: checkIn.updatedAt
  });

  return res.json({ status: "CHECKED_IN", checkIn });
});

app.post("/checkins/checkout", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  await prisma.checkIn.deleteMany({ where: { userId } });
  const friendIds = await getFriendIds(userId);
  emitToUsers([...friendIds, userId], "checkin:update", {
    userId,
    action: "CHECKED_OUT",
    at: new Date().toISOString()
  });

  return res.json({ ok: true });
});

app.get("/messages/conversations", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const friendIds = await getFriendIds(userId);

  const profiles = await prisma.profile.findMany({
    where: { userId: { in: friendIds } },
    select: { userId: true, username: true, displayName: true, avatar: true }
  });

  const convoData = await Promise.all(
    profiles.map(async (friend) => {
      const [latest, unread] = await Promise.all([
        prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, recipientId: friend.userId },
              { senderId: friend.userId, recipientId: userId }
            ]
          },
          orderBy: { sentAt: "desc" }
        }),
        prisma.message.count({
          where: {
            senderId: friend.userId,
            recipientId: userId,
            readAt: null
          }
        })
      ]);

      return {
        friend,
        latestMessage: latest,
        unreadCount: unread
      };
    })
  );

  convoData.sort((a, b) => {
    const aTs = a.latestMessage?.sentAt ? new Date(a.latestMessage.sentAt).getTime() : 0;
    const bTs = b.latestMessage?.sentAt ? new Date(b.latestMessage.sentAt).getTime() : 0;
    return bTs - aTs;
  });

  return res.json(convoData);
});

app.get("/messages/:friendId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const friendId = String(req.params.friendId);
  const friends = await assertFriends(userId, friendId);
  if (!friends) return res.status(403).json({ error: "Not friends" });

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, recipientId: friendId },
        { senderId: friendId, recipientId: userId }
      ]
    },
    orderBy: { sentAt: "asc" },
    take: 200
  });

  await prisma.message.updateMany({
    where: { senderId: friendId, recipientId: userId, readAt: null },
    data: { readAt: new Date() }
  });

  return res.json(messages);
});

app.post("/messages/:friendId", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ content: z.string().trim().min(1).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.auth!.userId;
  const friendId = String(req.params.friendId);

  const friends = await assertFriends(userId, friendId);
  if (!friends) return res.status(403).json({ error: "Not friends" });

  const message = await prisma.message.create({
    data: {
      senderId: userId,
      recipientId: friendId,
      content: parsed.data.content
    }
  });

  emitToUsers([friendId, userId], "message:new", message);
  return res.status(201).json(message);
});

app.get("/nudges", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const nudges = await prisma.nudge.findMany({
    where: { recipientId: userId, dismissedAt: null },
    include: {
      sender: { include: { profile: true } },
      bar: true
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json(
    nudges.map((n) => ({
      id: n.id,
      createdAt: n.createdAt,
      sender: {
        userId: n.senderId,
        displayName: n.sender.profile?.displayName ?? "Unknown",
        username: n.sender.profile?.username ?? "unknown",
        avatar: n.sender.profile?.avatar ?? "tiger"
      },
      bar: {
        id: n.bar.id,
        name: n.bar.name,
        vibeTags: parseVibeTags(n.bar.vibeTags)
      }
    }))
  );
});

app.post("/nudges", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ recipientId: z.string().cuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const senderId = req.auth!.userId;
  const recipientId = parsed.data.recipientId;

  const friends = await assertFriends(senderId, recipientId);
  if (!friends) return res.status(403).json({ error: "Not friends" });

  const current = nudgeRateMap.get(senderId) ?? [];
  const now = Date.now();
  const recent = current.filter((t) => now - t < 60_000);
  if (recent.length >= 5) return res.status(429).json({ error: "Too many nudges. Slow down." });
  recent.push(now);
  nudgeRateMap.set(senderId, recent);

  const senderCheckIn = await prisma.checkIn.findUnique({ where: { userId: senderId } });
  if (!senderCheckIn) return res.status(400).json({ error: "You must be checked in to send a nudge." });

  const nudge = await prisma.nudge.create({
    data: {
      senderId,
      recipientId,
      barId: senderCheckIn.barId
    },
    include: {
      sender: { include: { profile: true } },
      bar: true
    }
  });

  const payload = {
    id: nudge.id,
    createdAt: nudge.createdAt,
    sender: {
      userId: senderId,
      displayName: nudge.sender.profile?.displayName ?? "Unknown",
      username: nudge.sender.profile?.username ?? "unknown",
      avatar: nudge.sender.profile?.avatar ?? "tiger"
    },
    bar: {
      id: nudge.bar.id,
      name: nudge.bar.name,
      vibeTags: parseVibeTags(nudge.bar.vibeTags)
    }
  };

  emitToUsers([recipientId], "nudge:new", payload);
  return res.status(201).json(payload);
});

app.post("/nudges/:id/dismiss", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const nudgeId = String(req.params.id);
  const nudge = await prisma.nudge.findUnique({ where: { id: nudgeId } });
  if (!nudge || nudge.recipientId !== userId) return res.status(404).json({ error: "Nudge not found" });

  await prisma.nudge.update({
    where: { id: nudge.id },
    data: { dismissedAt: new Date() }
  });

  return res.json({ ok: true });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
});

const httpServer = http.createServer(app);
initRealtime(httpServer);

httpServer.listen(config.port, () => {
  console.log(`BarFlow backend running on http://localhost:${config.port}`);
});
