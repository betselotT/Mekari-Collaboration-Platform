"use client";

import { Bell, LogOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminFetch } from "../lib/api";
import { subscribeAdminDashboardUpdates } from "../lib/adminSocket";
import { registerAdminPushNotifications } from "../lib/pushNotifications";

type Summary = {
  pendingMentors: number;
  pendingReports: number;
  approvedMentors: number;
  totalUsers: number;
};

type Analytics = {
  metrics: {
    totalUsers: number;
    totalThreads: number;
    totalMessages: number;
    pendingReports: number;
    solvedThreads: number;
    aiResolvedThreads: number;
    announcementsSent: number;
  };
  userRoles: Array<{ label: string; value: number }>;
  threadStatuses: Array<{ label: string; value: number }>;
};

type Announcement = {
  id: string;
  title: string;
  message: string;
  audience: string;
  recipientCount: number;
  link?: string;
  createdAt: string;
};

type Verification = {
  _id: string;
  name: string;
  email: string;
  bio?: string;
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
  devicesUsed?: string[];
  collaborationGoals?: string;
  availabilityStatus?: string;
  expertise: Array<{ subject: string; proficiency: string }>;
  skillTags: string[];
  points: number;
  createdAt: string;
  expertVerification: {
    status: "pending" | "approved" | "rejected" | "not_required";
    reviewNote?: string;
    submittedAt?: string;
    reviewedAt?: string;
    document?: {
      fileName: string;
      fileType: string;
      fileSize: number;
      dataUrl?: string;
      uploadedAt?: string;
    };
  };
};

type ReportItem = {
  _id: string;
  reporterId?: ReportUser;
  targetType: "thread" | "message" | "user";
  targetId: string;
  target?: Record<string, any>;
  reason: string;
  actionTaken?: string;
  status: "pending" | "resolved" | "struck" | "dismissed";
  createdAt: string;
};

type ReportUser = {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  bio?: string;
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
  devicesUsed?: string[];
  expertise?: Array<{ subject: string; proficiency: string }>;
  skillTags?: string[];
  points?: number;
  isBanned?: boolean;
  bannedAt?: string;
  banReason?: string;
  createdAt?: string;
};

type ActivityLog = {
  id: string;
  date: string;
  actionType: string;
  action: string;
  actor?: string;
  actorEmail?: string;
  targetType?: string;
  target?: string;
  status?: string;
};

type AdminNotification = {
  _id: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

type ReportedUser = {
  userId: string;
  reportCount: number;
  pendingCount: number;
  strikeCount: number;
  dismissedCount: number;
  latestReportAt?: string;
  user?: ReportUser;
};

type AdminUser = ReportUser & {
  _id: string;
  collaborationGoals?: string;
  updatedAt?: string;
  availabilityStatus?: string;
  expertVerification?: {
    status: "pending" | "approved" | "rejected" | "not_required";
    reviewNote?: string;
    submittedAt?: string;
    reviewedAt?: string;
  };
  reviews?: Array<{
    by?: ReportUser;
    stars: number;
    comment?: string;
    createdAt?: string;
  }>;
  expertRatingAverage?: number;
  expertReviewCount?: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type ReportFilter = "all" | "pending" | "struck" | "dismissed";
type AdminSection = "analytics" | "announcements" | "verifications" | "users" | "reports" | "logs";
const PAGE_SIZE = 10;
const NOTIFICATION_PREVIEW_COUNT = 5;
const READ_AUDIT_NOTIFICATIONS_KEY = "mekari_admin_read_audit_notifications";

type AdminDashboardUpdate = {
  type?: string;
  id?: string;
  message?: string;
  createdAt?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  return dateFormatter.format(new Date(value));
}

function formatBytes(bytes?: number) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function targetLabel(report: ReportItem) {
  if (!report.target) return String(report.targetId);
  if (report.targetType === "thread") {
    return `${report.target.title || "Thread"} ${report.target.subject ? `(${report.target.subject})` : ""}`;
  }
  if (report.targetType === "message") {
    return String(report.target.body || "Message").slice(0, 120);
  }
  return `${report.target.name || "User"} ${report.target.email ? `(${report.target.email})` : ""}`;
}

function mergeAdminNotifications(
  fetched: AdminNotification[],
  current: AdminNotification[],
  readLocalIds: Set<string>
) {
  const byId = new Map<string, AdminNotification>();

  for (const notification of [...current, ...fetched]) {
    const existing = byId.get(notification._id);
    byId.set(notification._id, {
      ...notification,
      read: notification.read || existing?.read || readLocalIds.has(notification._id),
    });
  }

  return Array.from(byId.values())
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 30);
}

function readLocalNotificationIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(READ_AUDIT_NOTIFICATIONS_KEY) || "[]"
    );
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeLocalNotificationIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(READ_AUDIT_NOTIFICATIONS_KEY, JSON.stringify(Array.from(ids)));
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportedUsers, setReportedUsers] = useState<ReportedUser[]>([]);
  const [mentors, setMentors] = useState<AdminUser[]>([]);
  const [learners, setLearners] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<AdminSection>("verifications");
  const [verificationFilter, setVerificationFilter] = useState<StatusFilter>("pending");
  const [reportFilter, setReportFilter] = useState<ReportFilter>("pending");
  const [verificationPage, setVerificationPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [mentorPage, setMentorPage] = useState(1);
  const [learnerPage, setLearnerPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [logActionType, setLogActionType] = useState("all");
  const [verificationPagination, setVerificationPagination] = useState<Pagination | null>(null);
  const [reportPagination, setReportPagination] = useState<Pagination | null>(null);
  const [mentorPagination, setMentorPagination] = useState<Pagination | null>(null);
  const [learnerPagination, setLearnerPagination] = useState<Pagination | null>(null);
  const [logPagination, setLogPagination] = useState<Pagination | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [banReview, setBanReview] = useState<{ reportId: string; userName: string } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementAudience, setAnnouncementAudience] = useState("all");
  const [announcementLink, setAnnouncementLink] = useState("/dashboard");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [announcementStatus, setAnnouncementStatus] = useState<string | null>(null);
  const loadDashboardRef = useRef<() => Promise<void>>(async () => undefined);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);

  const metrics = useMemo(
    () => [
      { id: "pending-mentors", label: "Pending mentor reviews", value: summary?.pendingMentors ?? 0 },
      { id: "pending-reports", label: "Pending reports", value: summary?.pendingReports ?? 0 },
      { id: "approved-mentors", label: "Approved mentors", value: summary?.approvedMentors ?? 0 },
      { id: "total-users", label: "Total users", value: summary?.totalUsers ?? 0 },
    ],
    [summary]
  );
  const visibleNotifications = notificationsExpanded
    ? notifications
    : notifications.slice(0, NOTIFICATION_PREVIEW_COUNT);
  const hiddenNotificationCount = Math.max(0, notifications.length - visibleNotifications.length);
  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length;

  function openMetric(metricId: string) {
    if (metricId === "pending-mentors") {
      setActiveSection("verifications");
      setVerificationFilter("pending");
      setVerificationPage(1);
      return;
    }
    if (metricId === "pending-reports") {
      setActiveSection("reports");
      setReportFilter("pending");
      setReportPage(1);
      return;
    }
    if (metricId === "approved-mentors") {
      setActiveSection("verifications");
      setVerificationFilter("approved");
      setVerificationPage(1);
      return;
    }
    if (metricId === "total-users") {
      setActiveSection("users");
      setMentorPage(1);
      setLearnerPage(1);
    }
  }

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const verificationParams = new URLSearchParams({
        page: String(verificationPage),
        limit: String(PAGE_SIZE),
      });
      if (verificationFilter !== "all") verificationParams.set("status", verificationFilter);

      const reportParams = new URLSearchParams({
        page: String(reportPage),
        limit: String(PAGE_SIZE),
      });
      if (reportFilter !== "all") reportParams.set("status", reportFilter);

      const logParams = new URLSearchParams({
        page: String(logPage),
        limit: String(PAGE_SIZE),
      });
      if (logActionType !== "all") logParams.set("actionType", logActionType);

      const mentorParams = new URLSearchParams({
        role: "mentor",
        page: String(mentorPage),
        limit: String(PAGE_SIZE),
      });
      const learnerParams = new URLSearchParams({
        role: "learner",
        page: String(learnerPage),
        limit: String(PAGE_SIZE),
      });

      const [summaryRes, analyticsRes, announcementRes, verificationRes, mentorRes, learnerRes, reportRes, reportedUsersRes, logRes, notificationRes] = await Promise.all([
        adminFetch<{ summary: Summary }>("/api/admin/summary"),
        adminFetch<{ analytics: Analytics }>("/api/admin/analytics"),
        adminFetch<{ announcements: Announcement[] }>("/api/admin/announcements"),
        adminFetch<{ verifications: Verification[]; pagination: Pagination }>(
          `/api/admin/mentor-verifications?${verificationParams.toString()}`
        ),
        adminFetch<{ users: AdminUser[]; pagination: Pagination }>(
          `/api/admin/users?${mentorParams.toString()}`
        ),
        adminFetch<{ users: AdminUser[]; pagination: Pagination }>(
          `/api/admin/users?${learnerParams.toString()}`
        ),
        adminFetch<{ reports: ReportItem[]; pagination: Pagination }>(
          `/api/admin/reports?${reportParams.toString()}`
        ),
        adminFetch<{ reportedUsers: ReportedUser[] }>("/api/admin/reported-users"),
        adminFetch<{ logs: ActivityLog[]; actionTypes: string[]; pagination: Pagination }>(
          `/api/admin/action-logs?${logParams.toString()}`
        ),
        adminFetch<{ notifications: AdminNotification[] }>("/api/admin/notifications"),
      ]);

      setSummary(summaryRes.summary);
      setAnalytics(analyticsRes.analytics);
      setAnnouncements(announcementRes.announcements || []);
      setVerifications(verificationRes.verifications);
      setMentors(mentorRes.users);
      setLearners(learnerRes.users);
      setReports(reportRes.reports);
      setReportedUsers(reportedUsersRes.reportedUsers);
      setLogs(logRes.logs);
      setNotifications((current) =>
        mergeAdminNotifications(notificationRes.notifications || [], current, readLocalNotificationIds())
      );
      setActionTypes(logRes.actionTypes || []);
      setVerificationPagination(verificationRes.pagination);
      setMentorPagination(mentorRes.pagination);
      setLearnerPagination(learnerRes.pagination);
      setReportPagination(reportRes.pagination);
      setLogPagination(logRes.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardRef.current = loadDashboard;
  });

  useEffect(() => {
    loadDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationFilter, reportFilter, verificationPage, mentorPage, learnerPage, reportPage, logPage, logActionType]);

  useEffect(() => {
    const unsubscribe = subscribeAdminDashboardUpdates(handleRealtimeUpdate);
    return () => {
      unsubscribe();
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!notificationsOpen) return;
      const target = event.target;
      if (target instanceof Node && notificationsPanelRef.current?.contains(target)) return;
      setNotificationsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationsOpen]);

  function handleRealtimeUpdate(payload: unknown) {
    const update = payload as AdminDashboardUpdate;
    if (update?.message && (update.type === "report_created" || update.type === "mentor_verification_submitted")) {
      const notificationId = `realtime-${update.type}-${update.id || update.createdAt || Date.now()}`;
      setNotifications((current) => {
        if (current.some((item) => item._id === notificationId)) return current;
        return [
          {
            _id: notificationId,
            type: update.type || "admin_dashboard_update",
            message: update.message || "Admin dashboard updated.",
            link: update.type === "report_created" ? "/admin/reports" : "/admin/mentor-verifications",
            read: false,
            createdAt: update.createdAt || new Date().toISOString(),
          },
          ...current,
        ].slice(0, 30);
      });
    }

    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = setTimeout(() => {
      void loadDashboardRef.current();
    }, 350);
  }

  async function markAllNotificationsRead() {
    const unread = notifications.filter((notification) => !notification.read);
    if (unread.length === 0) return;

    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true }))
    );

    const localIds = readLocalNotificationIds();
    for (const notification of unread) {
      if (notification._id.startsWith("audit-") || notification._id.startsWith("realtime-")) {
        localIds.add(notification._id);
      }
    }
    writeLocalNotificationIds(localIds);

    try {
      await adminFetch("/api/admin/notifications/read-all", {
        method: "PATCH",
      });
    } catch {
      await loadDashboardRef.current();
    }
  }

  function openNotificationTarget(notification: AdminNotification) {
    if (notification.type === "new_report" || notification.link?.includes("reports")) {
      setActiveSection("reports");
      setReportFilter("pending");
      setReportPage(1);
    } else if (
      notification.type === "mentor_verification_submitted" ||
      notification.link?.includes("mentor-verifications")
    ) {
      setActiveSection("verifications");
      setVerificationFilter("pending");
      setVerificationPage(1);
    }

    setNotificationsOpen(false);
  }

  async function reviewMentor(userId: string, status: "pending" | "approved" | "rejected") {
    if (status === "rejected" && !reviewNotes[userId]?.trim()) {
      setReviewErrors((current) => ({ ...current, [userId]: "Rejection reason is required." }));
      return;
    }
    setSavingId(userId);
    setError(null);
    setReviewErrors((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    try {
      await adminFetch(`/api/admin/mentor-verifications/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          reviewNote: reviewNotes[userId] || undefined,
        }),
      });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review mentor");
    } finally {
      setSavingId(null);
    }
  }

  function applyReviewedReport(
    reportId: string,
    status: "struck" | "dismissed",
    actionTaken: string
  ) {
    let removedFromCurrentView = false;
    setReports((current) => {
      const next = current
        .map((report) =>
          report._id === reportId ? { ...report, status, actionTaken } : report
        )
        .filter((report) => {
          const visible =
            reportFilter === "all" ||
            reportFilter === report.status ||
            (reportFilter === "pending" && report.status === "pending");
          if (report._id === reportId && !visible) removedFromCurrentView = true;
          return visible;
        });
      return next;
    });

    if (removedFromCurrentView) {
      setReportPagination((current) =>
        current
          ? {
              ...current,
              total: Math.max(0, current.total - 1),
            }
          : current
      );
    }

    if (reportFilter === "pending") {
      setSummary((current) =>
        current
          ? { ...current, pendingReports: Math.max(0, current.pendingReports - 1) }
          : current
      );
      setAnalytics((current) =>
        current
          ? {
              ...current,
              metrics: {
                ...current.metrics,
                pendingReports: Math.max(0, current.metrics.pendingReports - 1),
              },
            }
          : current
      );
    }
  }

  function getStrikeCount(targetId: string) {
    return reportedUsers.find((item) => String(item.userId) === String(targetId))?.strikeCount || 0;
  }

  function requestReportStrike(report: ReportItem) {
    if (report.targetType === "user" && getStrikeCount(report.targetId) >= 2 && !report.target?.isBanned) {
      setBanReason("");
      setBanReview({
        reportId: report._id,
        userName: report.target?.name || report.target?.email || "this user",
      });
      return;
    }
    void updateReport(report._id, "struck");
  }

  async function updateReport(reportId: string, status: "struck" | "dismissed", options?: { banReason?: string }) {
    setSavingId(reportId);
    setError(null);
    const actionTaken = status === "struck"
      ? options?.banReason
        ? `Third strike issued. User banned: ${options.banReason}`
        : "Strike issued"
      : "Report dismissed";
    try {
      await adminFetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          actionTaken,
          banReason: options?.banReason,
        }),
      });
      applyReviewedReport(reportId, status, actionTaken);
      if (options?.banReason) {
        setBanReview(null);
        setBanReason("");
      }
      void loadDashboardRef.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update report");
    } finally {
      setSavingId(null);
    }
  }

  async function openUserProfile(userId: string) {
    setLoadingUserId(userId);
    setError(null);
    try {
      const res = await adminFetch<{ user: AdminUser }>(`/api/admin/users/${userId}`);
      setSelectedUser(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user profile");
    } finally {
      setLoadingUserId(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function enablePush() {
    setEnablingPush(true);
    setError(null);
    setPushStatus(null);
    try {
      const result = await registerAdminPushNotifications();
      if (!result.ok) {
        setError(result.reason || "Failed to enable admin push notifications.");
        return;
      }
      setPushStatus("Admin push notifications are enabled on this browser.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable admin push notifications.");
    } finally {
      setEnablingPush(false);
    }
  }

  async function sendAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingAnnouncement(true);
    setError(null);
    setAnnouncementStatus(null);
    try {
      const res = await adminFetch<{ announcement: Announcement }>("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: announcementTitle,
          message: announcementMessage,
          audience: announcementAudience,
          link: announcementLink || undefined,
        }),
      });
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementStatus(`Announcement sent to ${res.announcement.recipientCount} user(s).`);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send announcement");
    } finally {
      setSendingAnnouncement(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">M</div>
            <div>
              <h1>Mekari Admin</h1>
              <p>Verification, moderation, and system activity</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="topbar-meta">{loading ? "Syncing data" : "Admin Workspace"}</div>
            <div className="admin-notification-wrap" ref={notificationsPanelRef}>
              <button
                type="button"
                className="icon-button notification-button"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label="Alerts"
                title="Alerts"
              >
                <Bell size={20} aria-hidden="true" />
                {unreadNotificationCount > 0 ? <strong>{unreadNotificationCount}</strong> : null}
              </button>
              {notificationsOpen && (
                <div className="admin-notification-panel">
                  <div className="notification-panel-header">
                    <strong>Admin alerts</strong>
                    <button
                      className="link-button"
                      disabled={unreadNotificationCount === 0}
                      onClick={() => void markAllNotificationsRead()}
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="empty">No admin alerts yet.</div>
                  ) : (
                    <div className="admin-notification-list">
                      {visibleNotifications.map((notification) => (
                        <button
                          type="button"
                          className={`admin-notification-item ${notification.read ? "read" : "unread"}`}
                          key={notification._id}
                          onClick={() => openNotificationTarget(notification)}
                        >
                          <div>
                            <span>{notification.message}</span>
                            <small>{formatDate(notification.createdAt)}</small>
                          </div>
                        </button>
                      ))}
                      {hiddenNotificationCount > 0 && (
                        <button
                          type="button"
                          className="notification-expand-button"
                          onClick={() => setNotificationsExpanded(true)}
                        >
                          Show {hiddenNotificationCount} more
                        </button>
                      )}
                      {notificationsExpanded && notifications.length > NOTIFICATION_PREVIEW_COUNT && (
                        <button
                          type="button"
                          className="notification-expand-button"
                          onClick={() => setNotificationsExpanded(false)}
                        >
                          Show fewer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button className="icon-button" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut size={20} aria-hidden="true" />
            </button>
            <button className="button secondary" disabled={enablingPush} onClick={enablePush}>
              {enablingPush ? "Enabling..." : "Enable push"}
            </button>
          </div>
        </div>
      </header>

      <div className="content">
        {error && <div className="panel error">{error}</div>}
        {pushStatus && <div className="panel success-message">{pushStatus}</div>}
        {announcementStatus && <div className="panel success-message">{announcementStatus}</div>}
        {selectedUser && (
          <UserProfileModal user={selectedUser} onClose={() => setSelectedUser(null)} />
        )}
        {banReview && (
          <BanReasonModal
            userName={banReview.userName}
            reason={banReason}
            saving={savingId === banReview.reportId}
            onReasonChange={setBanReason}
            onClose={() => {
              setBanReview(null);
              setBanReason("");
            }}
            onConfirm={() => void updateReport(banReview.reportId, "struck", { banReason: banReason.trim() })}
          />
        )}

        <div className="admin-layout">
          <aside className="admin-sidebar">
            <button
              className={`nav-button ${activeSection === "analytics" ? "active" : ""}`}
              onClick={() => setActiveSection("analytics")}
            >
              <span>Analytics</span>
              <strong>{analytics?.metrics.totalThreads ?? 0}</strong>
            </button>
            <button
              className={`nav-button ${activeSection === "announcements" ? "active" : ""}`}
              onClick={() => setActiveSection("announcements")}
            >
              <span>Announcements</span>
              <strong>{analytics?.metrics.announcementsSent ?? 0}</strong>
            </button>
            <button
              className={`nav-button ${activeSection === "verifications" ? "active" : ""}`}
              onClick={() => setActiveSection("verifications")}
            >
              <span>Mentor Verification</span>
              <strong>{summary?.pendingMentors ?? 0}</strong>
            </button>
            <button
              className={`nav-button ${activeSection === "users" ? "active" : ""}`}
              onClick={() => setActiveSection("users")}
            >
              <span>Users</span>
              <strong>{summary?.totalUsers ?? 0}</strong>
            </button>
            <button
              className={`nav-button ${activeSection === "reports" ? "active" : ""}`}
              onClick={() => setActiveSection("reports")}
            >
              <span>Reports</span>
              <strong>{summary?.pendingReports ?? 0}</strong>
            </button>
            <button
              className={`nav-button ${activeSection === "logs" ? "active" : ""}`}
              onClick={() => setActiveSection("logs")}
            >
              <span>Action Log</span>
              <strong>{logPagination?.total ?? 0}</strong>
            </button>
          </aside>

          <div className="admin-main">
            <section className="metrics">
              {metrics.map((metric) => (
                <button
                  type="button"
                  className="metric"
                  key={metric.label}
                  onClick={() => openMetric(metric.id)}
                >
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </button>
              ))}
            </section>

        {activeSection === "analytics" && (
          <>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Analytics Dashboard</h2>
                <p>Platform activity and community health at a glance.</p>
              </div>
              <button className="button secondary" onClick={loadDashboard}>Refresh</button>
            </div>
            <div className="analytics-grid">
              <AnalyticsCard label="Platform users" value={analytics?.metrics.totalUsers ?? 0} />
              <AnalyticsCard label="Discussion threads" value={analytics?.metrics.totalThreads ?? 0} />
              <AnalyticsCard label="Messages posted" value={analytics?.metrics.totalMessages ?? 0} />
              <AnalyticsCard label="Pending reports" value={analytics?.metrics.pendingReports ?? 0} />
              <AnalyticsCard label="Solved threads" value={analytics?.metrics.solvedThreads ?? 0} />
              <AnalyticsCard label="AI-resolved threads" value={analytics?.metrics.aiResolvedThreads ?? 0} />
              <AnalyticsCard label="Announcements sent" value={analytics?.metrics.announcementsSent ?? 0} />
            </div>
          </section>
          <section className="analytics-columns">
            <DistributionPanel title="User Roles" items={analytics?.userRoles ?? []} />
            <DistributionPanel title="Thread Statuses" items={analytics?.threadStatuses ?? []} />
          </section>
          </>
        )}

        {activeSection === "announcements" && (
          <>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Send Announcement</h2>
                <p>Publish a notification about updates, downtime, or new features.</p>
              </div>
            </div>
            <form className="announcement-form" onSubmit={sendAnnouncement}>
              <label>
                <strong>Title</strong>
                <input
                  className="input"
                  maxLength={120}
                  placeholder="Scheduled maintenance"
                  required
                  value={announcementTitle}
                  onChange={(event) => setAnnouncementTitle(event.target.value)}
                />
              </label>
              <label>
                <strong>Audience</strong>
                <select
                  className="select"
                  value={announcementAudience}
                  onChange={(event) => setAnnouncementAudience(event.target.value)}
                >
                  <option value="all">All platform users</option>
                  <option value="learners">Learners</option>
                  <option value="mentors">Mentors</option>
                </select>
              </label>
              <label className="form-wide">
                <strong>Message</strong>
                <textarea
                  className="input"
                  maxLength={1000}
                  placeholder="Tell users what is changing and when."
                  required
                  rows={5}
                  value={announcementMessage}
                  onChange={(event) => setAnnouncementMessage(event.target.value)}
                />
              </label>
              <label className="form-wide">
                <strong>Notification link</strong>
                <input
                  className="input"
                  maxLength={300}
                  placeholder="/dashboard"
                  value={announcementLink}
                  onChange={(event) => setAnnouncementLink(event.target.value)}
                />
              </label>
              <div className="form-wide">
                <button className="button" disabled={sendingAnnouncement} type="submit">
                  {sendingAnnouncement ? "Sending..." : "Send notification"}
                </button>
              </div>
            </form>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Recent Announcements</h2>
                <p>A record of notifications published by administrators.</p>
              </div>
            </div>
            <div className="list">
              {announcements.map((announcement) => (
                <article className="announcement-item" key={announcement.id}>
                  <div>
                    <p className="item-title">{announcement.title}</p>
                    <p className="muted">{announcement.message}</p>
                  </div>
                  <div className="meta">
                    <span>{announcement.audience}</span>
                    <span>{announcement.recipientCount} recipient(s)</span>
                    <span>{formatDate(announcement.createdAt)}</span>
                  </div>
                </article>
              ))}
              {announcements.length === 0 && <div className="empty">No announcements have been sent yet.</div>}
            </div>
          </section>
          </>
        )}

        {activeSection === "verifications" && (
          <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Mentor Verification</h2>
              <p>Review uploaded documents from users who signed up as mentors.</p>
            </div>
            <div className="toolbar">
              <select
                className="select"
                value={verificationFilter}
                onChange={(event) => {
                  setVerificationFilter(event.target.value as StatusFilter);
                  setVerificationPage(1);
                }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
              <button className="button secondary" onClick={loadDashboard}>Refresh</button>
            </div>
          </div>

          <div className="list">
            {verifications.length === 0 && <div className="empty">No mentor verification requests match this filter.</div>}
            {verifications.map((item) => (
              <article className="review-item" key={item._id}>
                <div>
                  <p className="item-title">{item.name}</p>
                  <div className="meta">
                    <span>{item.email}</span>
                    <span>{item.primaryTechnicalField || "No field"}</span>
                    <span>{item.roleOrStatus || "No status"}</span>
                    <span>{item.yearsOfExperience || "No experience"}</span>
                    <span>Availability: {item.availabilityStatus || "offline"}</span>
                    <span>Submitted {formatDate(item.expertVerification.submittedAt)}</span>
                    <span className={`status ${item.expertVerification.status}`}>{item.expertVerification.status}</span>
                  </div>
                  <div className="detail-grid">
                    <div>
                      <strong>Bio</strong>
                      <span>{item.bio || "No bio provided."}</span>
                    </div>
                    <div>
                      <strong>Devices</strong>
                      <span>{item.devicesUsed?.length ? item.devicesUsed.join(", ") : "No devices listed."}</span>
                    </div>
                    <div>
                      <strong>Collaboration goals</strong>
                      <span>{item.collaborationGoals || "No goals provided."}</span>
                    </div>
                  </div>
                  <div className="chips">
                    {item.expertise.map((expertise) => (
                      <span className="chip" key={`${item._id}-${expertise.subject}`}>
                        {expertise.subject} · {expertise.proficiency}
                      </span>
                    ))}
                    {item.skillTags.map((tag) => (
                      <span className="chip" key={`${item._id}-${tag}`}>{tag}</span>
                    ))}
                  </div>
                  {item.expertVerification.document ? (
                    <div className="document-box">
                      <div>
                        <strong>{item.expertVerification.document.fileName}</strong>
                        <span>
                          {item.expertVerification.document.fileType} · {formatBytes(item.expertVerification.document.fileSize)}
                        </span>
                      </div>
                      <a className="button secondary" href={`/api/admin/mentor-verifications/${item._id}/document`} target="_blank" rel="noreferrer">
                        Open file
                      </a>
                    </div>
                  ) : (
                    <p className="muted">No document attached.</p>
                  )}
                  {item.expertVerification.reviewNote && (
                    <p className="muted">Review note: {item.expertVerification.reviewNote}</p>
                  )}
                </div>
                <div className="actions review-actions">
                  <textarea
                    className="input note"
                    placeholder="Review note. Required when rejecting."
                    value={reviewNotes[item._id] || ""}
                    onChange={(event) => {
                      setReviewNotes((current) => ({ ...current, [item._id]: event.target.value }));
                      if (event.target.value.trim()) {
                        setReviewErrors((current) => {
                          const next = { ...current };
                          delete next[item._id];
                          return next;
                        });
                      }
                    }}
                  />
                  <MentorStatusControl
                    currentStatus={item.expertVerification.status}
                    disabled={savingId === item._id}
                    onChange={(status) => reviewMentor(item._id, status)}
                  />
                  {reviewErrors[item._id] && (
                    <p className="inline-error">{reviewErrors[item._id]}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
          <Pager
            label="mentor verification requests"
            pagination={verificationPagination}
            onPrev={() => setVerificationPage((page) => Math.max(1, page - 1))}
            onNext={() => setVerificationPage((page) => page + 1)}
          />
          </section>
        )}

        {activeSection === "users" && (
          <>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Mentors</h2>
                <p>All users registered as mentors, including pending, approved, and rejected verification states.</p>
              </div>
              <button className="button secondary" onClick={loadDashboard}>Refresh</button>
            </div>
            <UserTable
              users={mentors}
              kind="mentor"
              loadingUserId={loadingUserId}
              onOpen={openUserProfile}
              savingId={savingId}
              onMentorStatusChange={reviewMentor}
            />
            <Pager
              label="mentors"
              pagination={mentorPagination}
              onPrev={() => setMentorPage((page) => Math.max(1, page - 1))}
              onNext={() => setMentorPage((page) => page + 1)}
            />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Learners</h2>
                <p>All learner accounts and general user accounts using the platform.</p>
              </div>
            </div>
            <UserTable
              users={learners}
              kind="learner"
              loadingUserId={loadingUserId}
              onOpen={openUserProfile}
              savingId={savingId}
            />
            <Pager
              label="learners"
              pagination={learnerPagination}
              onPrev={() => setLearnerPage((page) => Math.max(1, page - 1))}
              onNext={() => setLearnerPage((page) => page + 1)}
            />
          </section>
          </>
        )}

        {activeSection === "reports" && (
          <>
          <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Reports</h2>
              <p>Spam, inappropriate content, and user safety reports.</p>
            </div>
            <div className="toolbar">
              <select
                className="select"
                value={reportFilter}
                onChange={(event) => {
                  setReportFilter(event.target.value as ReportFilter);
                  setReportPage(1);
                }}
              >
                <option value="pending">Pending</option>
                <option value="struck">Struck</option>
                <option value="dismissed">Dismissed</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          <div className="list">
            {reports.length === 0 && <div className="empty">No reports match this filter.</div>}
            {reports.map((report) => (
              <article className="report-item" key={report._id}>
                <div>
                  <p className="item-title">{report.reason}</p>
                  <div className="meta">
                    <span>Reporter: {report.reporterId?.name || report.reporterId?.email || "Unknown"}</span>
                    <span>Target: {report.targetType}</span>
                    <span>{targetLabel(report)}</span>
                    <span>{formatDate(report.createdAt)}</span>
                    <span className={`status ${report.status}`}>{report.status}</span>
                  </div>
                  <div className="detail-grid report-detail-grid">
                    <UserDetail title="Reported by" user={report.reporterId} />
                    <UserDetail title="Reported user" user={report.targetType === "user" ? report.target : undefined} />
                    <div>
                      <strong>Current admin action</strong>
                      <span>{report.actionTaken || "No action recorded yet."}</span>
                    </div>
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="button danger"
                    disabled={savingId === report._id}
                    onClick={() => requestReportStrike(report)}
                  >
                    {report.targetType === "user" && getStrikeCount(report.targetId) >= 2 && !report.target?.isBanned
                      ? "Strike and ban"
                      : "Strike"}
                  </button>
                  <button
                    className="button secondary"
                    disabled={savingId === report._id}
                    onClick={() => updateReport(report._id, "dismissed")}
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            ))}
          </div>
          <Pager
            label="reports"
            pagination={reportPagination}
            onPrev={() => setReportPage((page) => Math.max(1, page - 1))}
            onNext={() => setReportPage((page) => page + 1)}
          />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Users With Report Strikes</h2>
                <p>Users ranked by how many times they have been reported.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Total Reports</th>
                    <th>Pending</th>
                    <th>Strikes</th>
                    <th>Dismissed</th>
                    <th>Account</th>
                    <th>Latest Report</th>
                  </tr>
                </thead>
                <tbody>
                  {reportedUsers.map((item) => (
                    <tr key={item.userId}>
                      <td>
                        {item.user?.name || "Unknown user"}
                        <div className="muted">{item.user?.email || String(item.userId)}</div>
                        <div className="muted">{item.user?.primaryTechnicalField || "No field"}</div>
                      </td>
                      <td>{item.user?.role || "Unknown"}</td>
                      <td><strong>{item.reportCount}</strong></td>
                      <td>{item.pendingCount}</td>
                      <td>{item.strikeCount}</td>
                      <td>{item.dismissedCount}</td>
                      <td>
                        <span className={`status ${item.user?.isBanned ? "rejected" : "approved"}`}>
                          {item.user?.isBanned ? "banned" : "active"}
                        </span>
                        {item.user?.banReason ? <div className="muted">{item.user.banReason}</div> : null}
                      </td>
                      <td>{formatDate(item.latestReportAt)}</td>
                    </tr>
                  ))}
                  {reportedUsers.length === 0 && (
                    <tr>
                      <td colSpan={8}>No reported users yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          </>
        )}

        {activeSection === "logs" && (
          <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Action Log</h2>
              <p>Recent platform activity synthesized from users, mentor reviews, reports, threads, and messages.</p>
            </div>
            <div className="toolbar">
              <select
                className="select"
                value={logActionType}
                onChange={(event) => {
                  setLogActionType(event.target.value);
                  setLogPage(1);
                }}
              >
                <option value="all">All action types</option>
                {actionTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action Type</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.date)}</td>
                    <td>{log.actionType}</td>
                    <td>{log.action}</td>
                    <td>
                      {log.actor || "System"}
                      {log.actorEmail ? <div className="muted">{log.actorEmail}</div> : null}
                    </td>
                    <td>
                      {log.targetType || "record"}
                      {log.target ? <div className="muted">{log.target}</div> : null}
                    </td>
                    <td>{log.status || "recorded"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            label="activity records"
            pagination={logPagination}
            onPrev={() => setLogPage((page) => Math.max(1, page - 1))}
            onNext={() => setLogPage((page) => page + 1)}
          />
          </section>
        )}
          </div>
        </div>
      </div>
    </main>
  );
}

function AnalyticsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="analytics-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DistributionPanel({ title, items }: { title: string; items: Array<{ label: string; value: number }> }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="panel distribution-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{total} record(s) across {items.length} categor{items.length === 1 ? "y" : "ies"}.</p>
        </div>
      </div>
      <div className="distribution-list">
        {items.map((item) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div className="distribution-row" key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.value} ({percentage}%)</span>
              </div>
              <div className="distribution-track">
                <span style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="empty">No analytics records are available yet.</div>}
      </div>
    </section>
  );
}

function UserTable({
  users,
  kind,
  loadingUserId,
  onOpen,
  savingId,
  onMentorStatusChange,
}: {
  users: AdminUser[];
  kind: "mentor" | "learner";
  loadingUserId: string | null;
  onOpen: (userId: string) => void;
  savingId: string | null;
  onMentorStatusChange?: (userId: string, status: "pending" | "approved" | "rejected") => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Profile</th>
            <th>Skills</th>
            <th>Status</th>
            <th>Points</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const expertise = Array.isArray(user.expertise)
              ? user.expertise.map((item) => `${item.subject} (${item.proficiency})`)
              : [];
            const skills = Array.isArray(user.skillTags) ? user.skillTags : [];
            const verificationStatus =
              kind === "mentor" ? user.expertVerification?.status || "pending" : user.role || "learner";

            return (
              <tr key={user._id}>
                <td>
                  <strong>{user.name || "Unnamed user"}</strong>
                  <div className="muted">{user.email || "No email"}</div>
                </td>
                <td>
                  {user.primaryTechnicalField || "No field"}
                  <div className="muted">{user.roleOrStatus || "No role/status"}</div>
                  <div className="muted">{user.yearsOfExperience || "No experience"}</div>
                </td>
                <td>
                  {expertise.concat(skills).slice(0, 5).join(", ") || "No skills listed"}
                </td>
                <td>
                  <span className={`status ${verificationStatus}`}>{verificationStatus}</span>
                  {kind === "mentor" && user.expertVerification?.reviewNote ? (
                    <div className="muted">{user.expertVerification.reviewNote}</div>
                  ) : null}
                  <div className="muted">Availability: {user.availabilityStatus || "offline"}</div>
                  {kind === "mentor" && onMentorStatusChange ? (
                    <div className="table-status-control">
                      <MentorStatusControl
                        compact
                        currentStatus={user.expertVerification?.status || "pending"}
                        disabled={savingId === user._id}
                        onChange={(status) => onMentorStatusChange(user._id, status)}
                      />
                    </div>
                  ) : null}
                </td>
                <td>{user.points || 0}</td>
                <td>
                  {formatDate(user.createdAt)}
                  <div>
                    <button
                      className="link-button"
                      disabled={loadingUserId === user._id}
                      onClick={() => onOpen(user._id)}
                    >
                      {loadingUserId === user._id ? "Opening..." : "View profile"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan={6}>No {kind === "mentor" ? "mentors" : "learners"} found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MentorStatusControl({
  currentStatus,
  disabled,
  compact = false,
  onChange,
}: {
  currentStatus: "pending" | "approved" | "rejected" | "not_required";
  disabled?: boolean;
  compact?: boolean;
  onChange: (status: "pending" | "approved" | "rejected") => void;
}) {
  const options: Array<{
    status: "pending" | "approved" | "rejected";
    label: string;
  }> = [
    { status: "pending", label: compact ? "Pending" : "Set Pending" },
    { status: "approved", label: "Approve" },
    { status: "rejected", label: "Reject" },
  ];

  return (
    <div className={`status-control ${compact ? "compact" : ""}`} role="group" aria-label="Mentor approval status">
      {options.map((option) => (
        <button
          key={option.status}
          type="button"
          disabled={disabled || currentStatus === option.status}
          className={`status-option ${option.status} ${currentStatus === option.status ? "active" : ""}`}
          onClick={() => onChange(option.status)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BanReasonModal({
  userName,
  reason,
  saving,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  userName: string;
  reason: string;
  saving: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="modal-card ban-reason-modal" role="dialog" aria-modal="true" aria-labelledby="ban-reason-title">
        <div>
          <h2 id="ban-reason-title">Ban {userName}</h2>
          <p>This is the third strike. The user will be blocked from signing in immediately.</p>
        </div>
        <label>
          <strong>Ban reason</strong>
          <textarea
            className="input"
            rows={4}
            maxLength={500}
            placeholder="Explain why this user is being banned."
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            autoFocus
          />
        </label>
        <div className="actions">
          <button className="button secondary" disabled={saving} onClick={onClose}>Cancel</button>
          <button className="button danger" disabled={saving || !reason.trim()} onClick={onConfirm}>
            {saving ? "Banning..." : "Ban user"}
          </button>
        </div>
      </section>
    </div>
  );
}

function UserProfileModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const expertise = Array.isArray(user.expertise)
    ? user.expertise.map((item) => `${item.subject} (${item.proficiency})`)
    : [];
  const skills = Array.isArray(user.skillTags) ? user.skillTags : [];
  const reviews = user.reviews || [];

  return (
    <div className="modal-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal-card user-profile-modal">
        <div className="panel-header">
          <div>
            <h2>{user.name || "User profile"}</h2>
            <p>{user.email || "No email"} - {user.role || "No role"}</p>
          </div>
          <button className="button secondary" onClick={onClose}>Close</button>
        </div>

        <div className="detail-grid">
          <div>
            <strong>Profile</strong>
            <span>{user.primaryTechnicalField || "No technical field"}</span>
            <span>{user.roleOrStatus || "No role/status"}</span>
            <span>{user.yearsOfExperience || "No experience listed"}</span>
            <span>Availability: {user.availabilityStatus || "offline"}</span>
          </div>
          <div>
            <strong>Account</strong>
            <span>Points: {user.points || 0}</span>
            <span>Joined: {formatDate(user.createdAt)}</span>
            <span>Updated: {formatDate(user.updatedAt)}</span>
            <span>Account: {user.isBanned ? "banned" : "active"}</span>
            {user.banReason ? <span>Ban reason: {user.banReason}</span> : null}
            <span>
              Verification:{" "}
              <span className={`status ${user.expertVerification?.status || "not_required"}`}>
                {user.expertVerification?.status || "not_required"}
              </span>
            </span>
          </div>
          <div>
            <strong>Bio</strong>
            <span>{user.bio || "No bio provided."}</span>
          </div>
          <div>
            <strong>Collaboration goals</strong>
            <span>{user.collaborationGoals || "No collaboration goals provided."}</span>
          </div>
          <div>
            <strong>Devices</strong>
            <span>{user.devicesUsed?.length ? user.devicesUsed.join(", ") : "No devices listed."}</span>
          </div>
          <div>
            <strong>Skills and expertise</strong>
            <span>{expertise.concat(skills).join(", ") || "No skills listed."}</span>
          </div>
        </div>

        {user.expertVerification?.reviewNote && (
          <p className="muted">Verification review note: {user.expertVerification.reviewNote}</p>
        )}

        <div className="panel nested-panel">
          <div className="panel-header">
            <div>
              <h2>Reviews</h2>
              <p>
                {user.expertReviewCount || 0} review{user.expertReviewCount === 1 ? "" : "s"}
                {user.expertRatingAverage ? ` - ${user.expertRatingAverage.toFixed(1)} average rating` : ""}
              </p>
            </div>
          </div>
          <div className="list">
            {reviews.map((review, index) => (
              <article className="report-item" key={`${review.by?._id || "review"}-${index}`}>
                <div>
                  <p className="item-title">{Number(review.stars || 0).toFixed(1)} / 5</p>
                  <div className="meta">
                    <span>By: {review.by?.name || review.by?.email || "Unknown reviewer"}</span>
                    <span>{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="muted">{review.comment || "No comment provided."}</p>
                </div>
              </article>
            ))}
            {reviews.length === 0 && <div className="empty">No reviews recorded for this user.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function UserDetail({ title, user }: { title: string; user?: ReportUser | Record<string, any> }) {
  if (!user) {
    return (
      <div>
        <strong>{title}</strong>
        <span>No user details available.</span>
      </div>
    );
  }

  const expertise = Array.isArray(user.expertise)
    ? user.expertise.map((item: { subject?: string; proficiency?: string }) => `${item.subject || "Expertise"} (${item.proficiency || "level"})`)
    : [];
  const skills = Array.isArray(user.skillTags) ? user.skillTags : [];

  return (
    <div>
      <strong>{title}</strong>
      <span>{user.name || "Unknown user"}</span>
      <span>{user.email || "No email"}</span>
      <span>{user.role || "No role"} - {user.primaryTechnicalField || "No field"} - {user.yearsOfExperience || "No experience"}</span>
      <span>{user.roleOrStatus || "No status"} - {user.points || 0} points</span>
      <span>{user.bio || "No bio provided."}</span>
      <span>{expertise.concat(skills).slice(0, 6).join(", ") || "No skills listed."}</span>
    </div>
  );
}

function Pager({
  label,
  pagination,
  onPrev,
  onNext,
}: {
  label: string;
  pagination: Pagination | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const page = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || 0;

  return (
    <div className="pager">
      <span>
        Page {page} of {totalPages} · {total} {label}
      </span>
      <div className="pager-actions">
        <button className="button secondary" disabled={page <= 1} onClick={onPrev}>
          Previous
        </button>
        <button className="button secondary" disabled={page >= totalPages} onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}
