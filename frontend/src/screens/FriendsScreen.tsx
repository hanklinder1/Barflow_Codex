import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { connectSocket } from "../socket";
import type { Friend, Message, Nudge, Profile } from "../types";

type FriendRequest = {
  id: string;
  fromUserId: string;
  createdAt: string;
  profile: Profile;
};

type Conversation = {
  friend: {
    userId: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  latestMessage: Message | null;
  unreadCount: number;
};

type Tab = "friends" | "search" | "requests";

export function FriendsScreen() {
  const navigate = useNavigate();
  const { friendId } = useParams();

  const [tab, setTab] = useState<Tab>("friends");
  const [groupByBar, setGroupByBar] = useState(false);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);

  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeConversation = useMemo(
    () => convos.find((conversation) => conversation.friend.userId === activeFriendId) ?? null,
    [convos, activeFriendId]
  );

  const groupedFriends = useMemo(() => {
    const groups: Record<string, Friend[]> = {};
    for (const friend of friends) {
      const key = friend.checkIn?.barName ?? "Not Out";
      groups[key] = groups[key] ?? [];
      groups[key].push(friend);
    }
    return groups;
  }, [friends]);

  async function load() {
    const [friendData, requestData, convoData] = await Promise.all([
      api<Friend[]>("/friends"),
      api<FriendRequest[]>("/friends/requests"),
      api<Conversation[]>("/messages/conversations")
    ]);

    setFriends(friendData);
    setIncoming(requestData);
    setConvos(convoData);

    if (!activeFriendId && convoData.length > 0) {
      setActiveFriendId(convoData[0].friend.userId);
    }
  }

  async function loadMessages(targetFriendId: string) {
    const data = await api<Message[]>(`/messages/${targetFriendId}`);
    setMessages(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));

    const socket = connectSocket();
    if (!socket) return;

    const refresh = () => load().catch(() => undefined);

    const onMessage = (message: Message) => {
      if (activeFriendId && (message.senderId === activeFriendId || message.recipientId === activeFriendId)) {
        setMessages((current) => [...current, message]);
      }
      refresh();
    };

    const onNudge = (payload: Nudge) => {
      setNotice(`${payload.sender.displayName} is requesting your presence at ${payload.bar.name}`);
    };

    socket.on("friend:request", refresh);
    socket.on("friend:accepted", refresh);
    socket.on("checkin:update", refresh);
    socket.on("message:new", onMessage);
    socket.on("nudge:new", onNudge);

    return () => {
      socket.off("friend:request", refresh);
      socket.off("friend:accepted", refresh);
      socket.off("checkin:update", refresh);
      socket.off("message:new", onMessage);
      socket.off("nudge:new", onNudge);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFriendId]);

  useEffect(() => {
    if (friendId) {
      setActiveFriendId(friendId);
      loadMessages(friendId).catch(() => undefined);
    }
  }, [friendId]);

  useEffect(() => {
    if (!activeFriendId) return;
    loadMessages(activeFriendId).catch(() => undefined);
  }, [activeFriendId]);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    const data = await api<Profile[]>(`/friends/search?q=${encodeURIComponent(query.trim())}`);
    setResults(data);
  }

  async function sendRequest(toUserId: string) {
    await api("/friends/requests", "POST", { toUserId });
    setResults((rows) => rows.filter((row) => row.userId !== toUserId));
    setNotice("Friend request sent.");
  }

  async function respond(requestId: string, action: "ACCEPT" | "DECLINE") {
    await api(`/friends/requests/${requestId}/respond`, "POST", { action });
    load();
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!activeFriendId || !text.trim()) return;

    const message = await api<Message>(`/messages/${activeFriendId}`, "POST", { content: text.trim() });
    setMessages((current) => [...current, message]);
    setText("");
    load();
  }

  async function sendNudge(targetFriendId: string) {
    try {
      await api("/nudges", "POST", { recipientId: targetFriendId });
      const target = friends.find((friend) => friend.userId === targetFriendId);
      setNotice(`Nudge sent to ${target?.displayName ?? "friend"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send nudge");
    }
  }

  function openChat(targetFriendId: string) {
    setActiveFriendId(targetFriendId);
    navigate(`/friends/${targetFriendId}`);
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <h1 className="title">Friends</h1>
        <p className="small">Connect with friends and see where they are</p>
        {notice ? <div className="notice-pill">{notice}</div> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <div className="split-panels">
        <section className="panel stack">
          <div className="friends-tabs">
            <button className={tab === "friends" ? "" : "secondary"} onClick={() => setTab("friends")}>
              Friends ({friends.length})
            </button>
            <button className={tab === "search" ? "" : "secondary"} onClick={() => setTab("search")}>
              Search
            </button>
            <button className={tab === "requests" ? "" : "secondary"} onClick={() => setTab("requests")}>
              Requests ({incoming.length})
            </button>
          </div>

          {tab === "friends" ? (
            <>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small">Your friends</span>
                <button className="secondary" onClick={() => setGroupByBar((current) => !current)}>
                  {groupByBar ? "Ungroup" : "Group by Bar"}
                </button>
              </div>

              {groupByBar
                ? Object.entries(groupedFriends).map(([group, members]) => (
                    <div className="stack" key={group}>
                      <h3 className="group-title">{group}</h3>
                      {members.map((friend) => (
                        <div key={friend.userId} className="list-item">
                          <div>
                            <strong>{friend.displayName}</strong>
                            <div className="small">@{friend.username}</div>
                          </div>
                          <div className="row wrap">
                            <button className="secondary" onClick={() => openChat(friend.userId)}>
                              Message
                            </button>
                            <button className="nudge-btn" onClick={() => sendNudge(friend.userId)}>
                              Nudge
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                : friends.map((friend) => (
                    <div key={friend.userId} className="list-item">
                      <div>
                        <strong>{friend.displayName}</strong>
                        <div className="small">@{friend.username}</div>
                        <div className="small">{friend.checkIn ? `At ${friend.checkIn.barName}` : "Not out"}</div>
                      </div>
                      <div className="row wrap">
                        <button className="secondary" onClick={() => openChat(friend.userId)}>
                          Message
                        </button>
                        <button className="nudge-btn" onClick={() => sendNudge(friend.userId)}>
                          Nudge
                        </button>
                      </div>
                    </div>
                  ))}

              {friends.length === 0 ? <div className="small">No friends yet. Use Search tab to add friends.</div> : null}
            </>
          ) : null}

          {tab === "search" ? (
            <>
              <form className="row" onSubmit={search}>
                <input
                  placeholder="Search by username"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit">Search</button>
              </form>
              {results.map((profile) => (
                <div key={profile.userId} className="list-item">
                  <div>
                    <strong>{profile.displayName}</strong>
                    <div className="small">@{profile.username}</div>
                  </div>
                  <button onClick={() => sendRequest(profile.userId)}>Add</button>
                </div>
              ))}
            </>
          ) : null}

          {tab === "requests" ? (
            <>
              {incoming.map((request) => (
                <div key={request.id} className="list-item">
                  <div>
                    <strong>{request.profile.displayName}</strong>
                    <div className="small">@{request.profile.username}</div>
                  </div>
                  <div className="row">
                    <button onClick={() => respond(request.id, "ACCEPT")}>Accept</button>
                    <button className="secondary" onClick={() => respond(request.id, "DECLINE")}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
              {incoming.length === 0 ? <div className="small">No pending friend requests.</div> : null}
            </>
          ) : null}
        </section>

        <section className="panel stack">
          <h2 className="section-title">Messages</h2>

          <div className="stack convo-list">
            {convos.map((conversation) => (
              <button
                type="button"
                key={conversation.friend.userId}
                className={`convo-item ${activeFriendId === conversation.friend.userId ? "active" : ""}`}
                onClick={() => openChat(conversation.friend.userId)}
              >
                <div>
                  <strong>{conversation.friend.displayName}</strong>
                  <div className="small">@{conversation.friend.username}</div>
                  <div className="small">{conversation.latestMessage?.content ?? "No messages yet"}</div>
                </div>
                {conversation.unreadCount > 0 ? <span className="badge">{conversation.unreadCount}</span> : null}
              </button>
            ))}
          </div>

          {activeConversation ? (
            <>
              <h3 className="group-title">Chat with {activeConversation.friend.displayName}</h3>
              <div className="message-thread">
                {messages.map((message) => (
                  <div className="message-bubble" key={message.id}>
                    <div>{message.content}</div>
                    <div className="small">{new Date(message.sentAt).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
              <form className="row" onSubmit={sendMessage}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type message"
                  style={{ flex: 1 }}
                />
                <button type="submit">Send</button>
              </form>
            </>
          ) : (
            <div className="small">Select a friend to start messaging.</div>
          )}

          {convos.length === 0 ? <div className="small">No conversations yet.</div> : null}
        </section>
      </div>

      <div className="small">
        Nudge behavior: Your friend receives a real-time notification that you are requesting their presence at your
        current bar.
      </div>

      <Link to="/settings" className="small">
        Open settings
      </Link>
    </div>
  );
}
