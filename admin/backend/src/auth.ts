import { Request, Response, NextFunction } from "express";

export const ADMIN_SESSION_COOKIE = "mekari_admin_session";

export function adminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || "MekariAdmin2026!";
}

export function adminSessionToken() {
  return process.env.ADMIN_SESSION_TOKEN || "mekari-admin-seeded-session";
}

export function readCookie(req: Request, name: string) {
  const cookieHeader = req.header("cookie");
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .map((cookie) => {
      const separatorIndex = cookie.indexOf("=");
      return [
        cookie.slice(0, separatorIndex),
        decodeURIComponent(cookie.slice(separatorIndex + 1)),
      ];
    })
    .find(([cookieName]) => cookieName === name)?.[1];
}

export function setAdminSessionCookie(res: Response) {
  res.cookie(ADMIN_SESSION_COOKIE, adminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 1000 * 60 * 60 * 8,
  });
}

export function clearAdminSessionCookie(res: Response) {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  if (readCookie(req, ADMIN_SESSION_COOKIE) !== adminSessionToken()) {
    res.status(401).json({ error: { message: "Admin login required" } });
    return;
  }

  next();
}
