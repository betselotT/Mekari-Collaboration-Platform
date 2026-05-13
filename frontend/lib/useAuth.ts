"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, getAuthToken } from "./api";

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  points: number;
  badges: string[];
  availabilityStatus: string;
}

export function useAuth(redirectIfUnauth = true) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      if (redirectIfUnauth) router.replace("/login");
      return;
    }

    apiClient
      .get<{ user: AuthUser }>("/api/users/me")
      .then((res) => setUser(res.data.user))
      .catch(() => {
        if (redirectIfUnauth) router.replace("/login");
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}
