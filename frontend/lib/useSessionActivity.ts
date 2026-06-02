"use client";

import { useEffect } from "react";
import { apiClient, clearAuthToken } from "./api";

const REFRESH_THROTTLE_MS = 5 * 60 * 1000;

export function useSessionActivity() {
  useEffect(() => {
    let lastRefreshAt = Date.now();
    let refreshing = false;

    async function refreshSession() {
      if (refreshing || Date.now() - lastRefreshAt < REFRESH_THROTTLE_MS) return;
      refreshing = true;
      try {
        await apiClient.post("/api/auth/session/refresh");
        lastRefreshAt = Date.now();
      } catch {
        clearAuthToken();
        window.location.href = "/login?expired=true";
      } finally {
        refreshing = false;
      }
    }

    const onActivity = () => void refreshSession();
    const events = ["click", "keydown", "pointerdown", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, []);
}
