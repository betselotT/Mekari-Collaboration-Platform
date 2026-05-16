"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, LogOut, MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useAuth } from "../../lib/useAuth";
import { apiClient, clearAuthToken } from "../../lib/api";
import { ensureSocket } from "../../lib/useSocket";

type NotificationItem = {
  _id?: string;
  id?: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

interface HeaderProps {
  title?: string;
  searchPlaceholder?: string;
}

export function Header({ title = "Dashboard", searchPlaceholder = "Search..." }: HeaderProps) {
  const { user } = useAuth(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const displayName = user?.name || "Mekari User";
  const displayRole =
    user?.role === "expert"
      ? "Mentor"
      : user?.role === "learner"
        ? "Learner"
        : user?.role
          ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
          : "Member";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "M";
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  function notificationId(notification: NotificationItem) {
    return notification._id || notification.id || "";
  }

  async function loadNotifications() {
    try {
      const res = await apiClient.get<{ notifications: NotificationItem[] }>("/api/notifications");
      setNotifications(res.data.notifications || []);
    } catch {
      setNotifications([]);
    }
  }

  useEffect(() => {
    if (!user?._id) return;
    loadNotifications();

    let cleanup: (() => void) | undefined;
    let mounted = true;
    ensureSocket().then((socket) => {
      if (!mounted) return;
      const handleNotification = (notification: NotificationItem) => {
        setNotifications((current) => {
          const id = notificationId(notification);
          if (id && current.some((item) => notificationId(item) === id)) return current;
          return [{ ...notification, read: false }, ...current].slice(0, 50);
        });
      };
      socket.on("notification", handleNotification);
      cleanup = () => socket.off("notification", handleNotification);
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [user?._id]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    await apiClient.patch("/api/notifications/read-all").catch(() => loadNotifications());
  }

  async function openNotification(notification: NotificationItem) {
    const id = notificationId(notification);
    if (id && !notification.read) {
      setNotifications((current) =>
        current.map((item) =>
          notificationId(item) === id ? { ...item, read: true } : item
        )
      );
      await apiClient.patch(`/api/notifications/${id}`).catch(() => loadNotifications());
    }
    if (notification.link) window.location.href = notification.link;
  }

  async function handleLogout() {
    try {
      await apiClient.post("/api/auth/logout");
    } catch {
      // JWT auth is client-held, so local cleanup is enough even if the network call fails.
    } finally {
      clearAuthToken();
      window.location.href = "/login";
    }
  }

  return (
    <header className="fixed right-0 top-0 z-30 flex h-16 w-[calc(100%-240px)] items-center justify-between border-b border-neutral-200 bg-white px-8 dark:border-neutral-700 dark:bg-neutral-900">
      {/* Left side - Title and Search */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-neutral-900 dark:text-white">{title}</h1>
        <div className="relative hidden md:flex">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="input pl-10"
            style={{ width: "300px" }}
          />
        </div>
      </div>

      {/* Right side - Actions and Profile */}
      <div className="flex items-center gap-4">
        <div ref={panelRef} className="relative">
          <button
            type="button"
            className="relative rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            onClick={() => setOpen((value) => !value)}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-3 w-96 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Notifications</h2>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-semibold text-primary-600 hover:underline dark:text-primary-400"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notificationId(notification)}
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={`block w-full border-b border-neutral-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800 ${
                        notification.read ? "" : "bg-primary-50/70 dark:bg-primary-950/20"
                      }`}
                    >
                      <div className="flex gap-3">
                        <span
                          className={`mt-1 h-2 w-2 rounded-full ${
                            notification.read ? "bg-neutral-300" : "bg-primary-600"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-neutral-900 dark:text-white">
                            {notification.message}
                          </span>
                          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                            {new Date(notification.createdAt).toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        <Link
          href="/dashboard/messages"
          className="relative p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors dark:text-neutral-400 dark:hover:bg-neutral-800"
          aria-label="Messages"
          title="Messages"
        >
          <MessageCircle className="h-5 w-5" />
        </Link>

        <ThemeToggle />

        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <LogOut className="h-5 w-5" />
        </button>

        <div className="ml-2 flex items-center gap-3 border-l border-neutral-200 pl-4 dark:border-neutral-700">
          <div className="text-right">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">{displayName}</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{displayRole}</p>
          </div>
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={displayName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-400 to-red-500 flex items-center justify-center text-white font-bold">
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
