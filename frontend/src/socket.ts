import { io, Socket } from "socket.io-client";
import { getToken } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function connectSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket?.connected) return socket;

  socket = io(API_BASE, {
    auth: { token }
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
