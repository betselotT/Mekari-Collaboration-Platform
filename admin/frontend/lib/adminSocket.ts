"use client";

import { io, Socket } from "socket.io-client";

const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";

function stripApiSuffix(value: string) {
  return value.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

function resolveMainSocketUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  if (apiBaseUrl) return stripApiSuffix(apiBaseUrl);

  return "http://localhost:4000";
}

function resolveAdminSocketUrl() {
  if (process.env.NEXT_PUBLIC_ADMIN_SOCKET_URL) return process.env.NEXT_PUBLIC_ADMIN_SOCKET_URL;

  return "http://localhost:4100";
}

function connectAdminSocket(url: string) {
  const socket = io(url, {
    auth: { adminApiKey },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    socket.emit("join_admin_dashboard");
  });

  return socket;
}

export function subscribeAdminDashboardUpdates(
  onUpdate: (payload: unknown) => void
) {
  const urls = Array.from(new Set([resolveMainSocketUrl(), resolveAdminSocketUrl()]));
  const sockets: Socket[] = urls.map(connectAdminSocket);

  sockets.forEach((socket) => {
    socket.on("admin_dashboard_update", onUpdate);
  });

  return () => {
    sockets.forEach((socket) => {
      socket.emit("leave_admin_dashboard");
      socket.off("admin_dashboard_update", onUpdate);
      socket.disconnect();
    });
  };
}
