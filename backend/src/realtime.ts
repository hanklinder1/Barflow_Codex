import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { decodeToken } from "./auth.js";

let io: Server | null = null;

export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.clientOrigin,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error("Unauthorized"));
      }
      const payload = decodeToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(userId);
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error("Realtime not initialized");
  return io;
}
