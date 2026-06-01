import { broadcastToRoom } from "./realtime";

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

export function broadcastAdminDashboardUpdate(update: Omit<AdminDashboardUpdate, "createdAt">) {
  return broadcastToRoom(ADMIN_DASHBOARD_ROOM, "admin_dashboard_update", {
    ...update,
    createdAt: new Date().toISOString(),
  });
}
