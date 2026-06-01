import { Server, Socket } from "socket.io";

export const ADMIN_DASHBOARD_ROOM = "admin:dashboard";

export type AdminDashboardUpdate = {
  type:
    | "report_created"
    | "report_reviewed"
    | "mentor_verification_submitted"
    | "mentor_verification_reviewed"
    | "announcement_sent";
  id?: string;
  message?: string;
  createdAt: string;
};

let ioRef: Server | null = null;

function canJoinAdminDashboard(socket: Socket) {
  const expectedKey = process.env.ADMIN_API_KEY?.trim();
  if (!expectedKey) return true;

  const providedKey = socket.handshake.auth?.adminApiKey;
  return typeof providedKey === "string" && providedKey === expectedKey;
}

export function initAdminRealtime(io: Server) {
  ioRef = io;

  io.on("connection", (socket) => {
    socket.on("join_admin_dashboard", () => {
      if (!canJoinAdminDashboard(socket)) return;
      socket.join(ADMIN_DASHBOARD_ROOM);
    });

    socket.on("leave_admin_dashboard", () => {
      socket.leave(ADMIN_DASHBOARD_ROOM);
    });
  });
}

export function broadcastAdminDashboardUpdate(update: Omit<AdminDashboardUpdate, "createdAt">) {
  ioRef?.to(ADMIN_DASHBOARD_ROOM).emit("admin_dashboard_update", {
    ...update,
    createdAt: new Date().toISOString(),
  });
}
