"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { getAuthToken } from "./api";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/api\/?$/, "") ||
  "http://localhost:4000";

let globalSocket: Socket | null = null;
let globalSocketToken: string | null = null;

export function getSocket(): Socket | null {
  return globalSocket;
}

export async function ensureSocket(): Promise<Socket> {
  const { io } = await import("socket.io-client");
  const token = getAuthToken();

  if (globalSocket && globalSocketToken === token) return globalSocket;

  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }
  globalSocketToken = token;

  globalSocket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    transports: ["websocket", "polling"],
  });

  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let heartbeat: ReturnType<typeof setInterval>;

    ensureSocket().then((socket) => {
      socketRef.current = socket;

      // CRITICAL BEHAVIOR #3 — send presence ping every 30 s
      heartbeat = setInterval(() => {
        if (socket.connected) {
          socket.emit("update_presence", "online");
        }
      }, 30_000);

      // Initial ping on connect / reconnect
      socket.on("connect", () => {
        socket.emit("update_presence", "online");
      });
    });

    return () => {
      clearInterval(heartbeat);
    };
  }, []);

  return socketRef;
}
