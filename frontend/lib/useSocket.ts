"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { apiClient, clearAuthToken } from "./api";

function resolveSocketUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/api\/?$/, "");
  if (apiBaseUrl) {
    return apiBaseUrl;
  }

  if (typeof window !== "undefined" && window.location.hostname.endsWith("vercel.app")) {
    return "https://mekari-collaboration-platform.onrender.com";
  }

  return "http://localhost:4000";
}

const SOCKET_URL = resolveSocketUrl();

let globalSocket: Socket | null = null;

export function getSocket(): Socket | null {
  return globalSocket;
}

export async function ensureSocket(): Promise<Socket> {
  const { io } = await import("socket.io-client");
  if (globalSocket) return globalSocket;

  globalSocket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    transports: ["websocket", "polling"],
  });
  globalSocket.on("session_expired", async () => {
    try {
      await apiClient.post("/api/auth/session/refresh");
      globalSocket?.connect();
    } catch {
      clearAuthToken();
      window.location.href = "/login?expired=true";
    }
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
