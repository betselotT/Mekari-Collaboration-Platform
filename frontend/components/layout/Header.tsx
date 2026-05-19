"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, LogOut, Menu, MessageCircle, Search } from "lucide-react";
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
  onMenuClick?: () => void;
}

export function Header({ title = "Dashboard", searchPlaceholder = "Search...", onMenuClick }: HeaderProps) {
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
    <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 dark:border-neutral-700 dark:bg-neutral-900 sm:px-6 lg:left-60 lg:px-8">
      {/* Left side - Title and Search */}
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 lg:hidden"
          aria-label="Open navigation"
          title="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-bold text-neutral-900 dark:text-white sm:text-lg">{title}</h1>
        <div className="relative hidden md:flex md:w-64 xl:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="input w-full pl-10"
          />
        </div>
      </div>

      {/* Right side - Actions and Profile */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-4">
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
            <div className="fixed left-4 right-4 top-16 mt-2 max-h-[calc(100vh-5rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-96 sm:max-w-sm">
              <div className="flex min-w-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
                <h2 className="min-w-0 truncate text-sm font-bold text-neutral-900 dark:text-white">Notifications</h2>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="shrink-0 text-xs font-semibold text-primary-600 hover:underline dark:text-primary-400"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-[calc(100vh-9rem)] overflow-y-auto sm:max-h-96">
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
                      <div className="flex min-w-0 gap-3">
                        <span
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                            notification.read ? "bg-neutral-300" : "bg-primary-600"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-medium text-neutral-900 dark:text-white">
                            {notification.message}
                          </span>
                          <span className="mt-1 block break-words text-xs text-neutral-500 dark:text-neutral-400">
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

        <div className="ml-1 flex items-center gap-3 border-l border-neutral-200 pl-2 dark:border-neutral-700 sm:ml-2 sm:pl-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">{displayName}</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{displayRole}</p>
          </div>
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={displayName}
              className="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-red-500 font-bold text-white sm:h-10 sm:w-10">
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
