"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Search, ShieldAlert, UserCheck } from "lucide-react";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Avatar } from "../../../components/ui/Avatar";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { SearchInput } from "../../../components/ui/Input";
import { apiClient } from "../../../lib/api";
import { useLanguage } from "../../../lib/i18n";

type ReportRole = "mentor" | "user";

type DirectoryUser = {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "learner" | "expert" | "user" | "admin" | "mod";
  bio?: string;
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
  expertise?: Array<{ subject: string; proficiency: string }>;
  skillTags?: string[];
  availabilityStatus?: string;
  points?: number;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function roleLabel(user: DirectoryUser) {
  return user.role === "expert" ? "Mentor" : "Learner";
}

export default function ReportsPage() {
  const { t } = useLanguage();
  const [role, setRole] = useState<ReportRole>("mentor");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [reason, setReason] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canSubmit = Boolean(selectedUser && reason.trim().length >= 5);

  const selectedSkills = useMemo(() => {
    if (!selectedUser) return [];
    const expertise = selectedUser.expertise?.map((item) => item.subject) || [];
    return Array.from(new Set([...expertise, ...(selectedUser.skillTags || [])])).slice(0, 6);
  }, [selectedUser]);

  useEffect(() => {
    let active = true;
    setLoadingUsers(true);
    setError("");

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        role,
        page: String(userPage),
        limit: "10",
      });
      if (query.trim()) params.set("q", query.trim());

      apiClient
        .get<{
          users: DirectoryUser[];
          pagination: { page: number; limit: number; total: number; totalPages: number };
        }>(`/api/users/directory?${params.toString()}`)
        .then((res) => {
          if (active) {
            setUsers(res.data.users || []);
            setUserPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
          }
        })
        .catch((err) => {
          if (active) {
            setError(err.response?.data?.error?.message || t("Failed to load users."));
            setUsers([]);
          }
        })
        .finally(() => {
          if (active) setLoadingUsers(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [role, query, userPage]);

  useEffect(() => {
    setUserPage(1);
  }, [role, query]);

  function handleRoleChange(nextRole: ReportRole) {
    setRole(nextRole);
    setSelectedUser(null);
    setQuery("");
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUser) {
      setError(t("Select the user you want to report."));
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await apiClient.post("/api/reports", {
        targetType: "user",
        targetId: selectedUser._id,
        reason: reason.trim(),
      });

      setMessage(t("Report submitted. An admin will review it from the moderation dashboard."));
      setReason("");
      setSelectedUser(null);
      setQuery("");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t("Failed to submit report."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout title={t("Report User")} searchPlaceholder={t("Search reports and safety...")}>
      <div className="mb-8 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{t("Spam & Safety Report")}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t("Report offensive behavior, spam, harassment, or other actions that break community trust.")}
            </p>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-lg border p-4 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
        >
          {error ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {error || message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card>
          <div className="mb-5">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{t("1. Choose who to report")}</h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {t("Pick mentors or users first, then search by name, email, field, or skill.")}
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900">
            {(["mentor", "user"] as ReportRole[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleRoleChange(item)}
                className={`rounded px-3 py-2 text-sm font-semibold capitalize transition ${
                  role === item
                    ? "bg-white text-primary-700 shadow-sm dark:bg-neutral-800 dark:text-primary-300"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {item === "mentor" ? t("Mentors") : t("Users")}
              </button>
            ))}
          </div>

          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(role === "mentor" ? "Search mentors by name..." : "Search users by name...")}
          />

          <div className="mt-5 grid gap-3">
            {loadingUsers ? (
              <div className="rounded-lg border border-neutral-200 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                {t("Loading users...")}
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                {t(role === "mentor" ? "No mentors found." : "No users found.")}
              </div>
            ) : (
              users.map((user) => {
                const selected = selectedUser?._id === user._id;
                return (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${
                      selected
                        ? "border-primary-500 bg-primary-50 dark:border-primary-700 dark:bg-primary-950/40"
                        : "border-neutral-200 bg-white hover:border-primary-200 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-primary-800"
                    }`}
                  >
                    <Avatar size="md" initials={initials(user.name)} src={user.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-neutral-900 dark:text-white">{user.name}</span>
                        <Badge variant={user.role === "expert" ? "primary" : "default"}>{roleLabel(user)}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-neutral-600 dark:text-neutral-400">{user.email}</p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                        {user.primaryTechnicalField || "No field listed"} - {user.roleOrStatus || "No status"} - {user.yearsOfExperience || "No experience listed"}
                      </p>
                    </div>
                    {selected && <UserCheck className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-300" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-neutral-200 pt-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {t("Page")} {userPagination.page} {t("of")} {userPagination.totalPages} - {userPagination.total} {t(role === "mentor" ? "mentor" : "user")}
              {userPagination.total === 1 ? "" : t("pluralSuffix")}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={userPagination.page <= 1 || loadingUsers}
                onClick={() => setUserPage((page) => Math.max(1, page - 1))}
              >
                {t("Previous")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={userPagination.page >= userPagination.totalPages || loadingUsers}
                onClick={() => setUserPage((page) => page + 1)}
              >
                {t("Next")}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-5">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{t("2. Describe the issue")}</h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {t("Give admins enough context to review what happened and take the right action.")}
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t("Report reason")}</span>
              <textarea
                className="min-h-44 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                placeholder={t("Describe the offensive action, spam, harassment, or bad behavior...")}
              />
            </label>
            <div className="mt-2 flex justify-between text-xs text-neutral-500">
              <span>{t("Minimum 5 characters")}</span>
              <span>{reason.length}/1000</span>
            </div>

            <Button type="submit" className="mt-5 w-full" isLoading={submitting} disabled={!canSubmit}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              {t("Submit Report")}
            </Button>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <h3 className="font-bold text-neutral-900 dark:text-white">{t("Selected user")}</h3>
            </div>

            {selectedUser ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar size="lg" initials={initials(selectedUser.name)} src={selectedUser.avatarUrl} />
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 dark:text-white">{selectedUser.name}</p>
                    <p className="truncate text-sm text-neutral-600 dark:text-neutral-400">{selectedUser.email}</p>
                    <p className="mt-1 text-xs text-neutral-500">{selectedUser.points || 0} {t("Points")}</p>
                  </div>
                </div>
                <div className="grid gap-3 text-sm">
                  <div>
                    <span className="font-medium text-neutral-900 dark:text-white">{t("Field")}</span>
                    <p className="text-neutral-600 dark:text-neutral-400">{selectedUser.primaryTechnicalField || t("Not listed")}</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-900 dark:text-white">{t("Bio")}</span>
                    <p className="text-neutral-600 dark:text-neutral-400">{selectedUser.bio || t("No bio provided.")}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSkills.length > 0 ? (
                    selectedSkills.map((skill) => <Badge key={skill}>{skill}</Badge>)
                  ) : (
                    <Badge variant="default">{t("No skills listed")}</Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t("Select a user from the search results to include their profile details in the report.")}
              </p>
            )}
          </Card>
        </div>
      </form>
    </DashboardLayout>
  );
}
