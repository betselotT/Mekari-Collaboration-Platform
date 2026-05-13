"use client";

import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../lib/api";

type Summary = {
  pendingMentors: number;
  pendingReports: number;
  approvedMentors: number;
  totalUsers: number;
};

type Verification = {
  _id: string;
  name: string;
  email: string;
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
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
      dataUrl: string;
      uploadedAt?: string;
    };
  };
};

type ReportItem = {
  _id: string;
  reporterId?: { name?: string; email?: string };
  targetType: "thread" | "message" | "user";
  targetId: string;
  target?: Record<string, any>;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
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

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type ReportFilter = "all" | "pending" | "resolved" | "dismissed";

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

export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [verificationFilter, setVerificationFilter] = useState<StatusFilter>("pending");
  const [reportFilter, setReportFilter] = useState<ReportFilter>("pending");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(
    () => [
      { label: "Pending mentor reviews", value: summary?.pendingMentors ?? 0 },
      { label: "Pending reports", value: summary?.pendingReports ?? 0 },
      { label: "Approved mentors", value: summary?.approvedMentors ?? 0 },
      { label: "Total users", value: summary?.totalUsers ?? 0 },
    ],
    [summary]
  );

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const verificationQuery = verificationFilter === "all" ? "" : `?status=${verificationFilter}`;
      const reportQuery = reportFilter === "all" ? "" : `?status=${reportFilter}`;
      const [summaryRes, verificationRes, reportRes, logRes] = await Promise.all([
        adminFetch<{ summary: Summary }>("/api/admin/summary"),
        adminFetch<{ verifications: Verification[] }>(`/api/admin/mentor-verifications${verificationQuery}`),
        adminFetch<{ reports: ReportItem[] }>(`/api/admin/reports${reportQuery}`),
        adminFetch<{ logs: ActivityLog[] }>("/api/admin/action-logs?limit=120"),
      ]);

      setSummary(summaryRes.summary);
      setVerifications(verificationRes.verifications);
      setReports(reportRes.reports);
      setLogs(logRes.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationFilter, reportFilter]);

  async function reviewMentor(userId: string, status: "approved" | "rejected") {
    setSavingId(userId);
    setError(null);
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

  async function updateReport(reportId: string, status: "resolved" | "dismissed" | "pending") {
    setSavingId(reportId);
    setError(null);
    try {
      await adminFetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update report");
    } finally {
      setSavingId(null);
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
          <div className="topbar-meta">{loading ? "Syncing data" : "Live admin workspace"}</div>
        </div>
      </header>

      <div className="content">
        {error && <div className="panel error">{error}</div>}

        <section className="metrics">
          {metrics.map((metric) => (
            <div className="metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </section>

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
                onChange={(event) => setVerificationFilter(event.target.value as StatusFilter)}
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
                    <span>Submitted {formatDate(item.expertVerification.submittedAt)}</span>
                    <span className={`status ${item.expertVerification.status}`}>{item.expertVerification.status}</span>
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
                    <p className="muted">
                      Document:{" "}
                      <a href={item.expertVerification.document.dataUrl} target="_blank" rel="noreferrer">
                        {item.expertVerification.document.fileName}
                      </a>{" "}
                      ({item.expertVerification.document.fileType}, {formatBytes(item.expertVerification.document.fileSize)})
                    </p>
                  ) : (
                    <p className="muted">No document attached.</p>
                  )}
                  {item.expertVerification.reviewNote && (
                    <p className="muted">Review note: {item.expertVerification.reviewNote}</p>
                  )}
                </div>
                <div className="actions">
                  <textarea
                    className="input note"
                    placeholder="Review note"
                    value={reviewNotes[item._id] || ""}
                    onChange={(event) => setReviewNotes((current) => ({ ...current, [item._id]: event.target.value }))}
                  />
                  <button
                    className="button"
                    disabled={savingId === item._id}
                    onClick={() => reviewMentor(item._id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className="button danger"
                    disabled={savingId === item._id}
                    onClick={() => reviewMentor(item._id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

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
                onChange={(event) => setReportFilter(event.target.value as ReportFilter)}
              >
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
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
                </div>
                <div className="actions">
                  <button
                    className="button"
                    disabled={savingId === report._id}
                    onClick={() => updateReport(report._id, "resolved")}
                  >
                    Mark resolved
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
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Action Log</h2>
              <p>Recent platform activity synthesized from users, mentor reviews, reports, threads, and messages.</p>
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
        </section>
      </div>
    </main>
  );
}
