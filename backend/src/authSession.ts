import crypto from "crypto";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";

export const AUTH_SESSION_COOKIE = "mekari_session";
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

type SessionPayload = {
  sub: string;
  role: string;
  exp?: number;
};

type OAuthExchangePayload = SessionPayload & {
  purpose: "oauth_exchange";
  jti: string;
};

const consumedOAuthExchangeCodes = new Map<string, number>();

function jwtSecret() {
  return process.env.JWT_SECRET || "dev-secret";
}

function cookieSameSite(): "lax" | "strict" | "none" {
  const configured = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  if (configured === "strict" || configured === "none") return configured;
  return "lax";
}

function cookieOptions() {
  const sameSite = cookieSameSite();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    maxAge: SESSION_IDLE_TIMEOUT_MS,
    path: "/",
  } as const;
}

export function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .map((cookie) => {
      const separatorIndex = cookie.indexOf("=");
      if (separatorIndex < 0) return ["", ""];
      return [
        cookie.slice(0, separatorIndex),
        decodeURIComponent(cookie.slice(separatorIndex + 1)),
      ];
    })
    .find(([cookieName]) => cookieName === name)?.[1];
}

export function readSessionToken(req: Request) {
  return readCookie(req.header("cookie"), AUTH_SESSION_COOKIE);
}

export function verifySessionToken(token: string): SessionPayload {
  return jwt.verify(token, jwtSecret()) as SessionPayload;
}

export function setSessionCookie(res: Response, userId: string, role: string) {
  const token = jwt.sign({ sub: userId, role }, jwtSecret(), {
    expiresIn: Math.floor(SESSION_IDLE_TIMEOUT_MS / 1000),
  });
  res.cookie(AUTH_SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(AUTH_SESSION_COOKIE, options);
}

export function signOAuthExchangeCode(userId: string, role: string) {
  return jwt.sign(
    {
      sub: userId,
      role,
      purpose: "oauth_exchange",
      jti: crypto.randomUUID(),
    },
    jwtSecret(),
    { expiresIn: "1m" }
  );
}

export function consumeOAuthExchangeCode(code: string) {
  const now = Date.now();
  for (const [jti, expiresAt] of consumedOAuthExchangeCodes) {
    if (expiresAt <= now) consumedOAuthExchangeCodes.delete(jti);
  }

  const payload = jwt.verify(code, jwtSecret()) as OAuthExchangePayload;
  if (payload.purpose !== "oauth_exchange" || !payload.sub || !payload.role || !payload.jti) {
    throw new Error("Invalid OAuth exchange code");
  }
  if (consumedOAuthExchangeCodes.has(payload.jti)) {
    throw new Error("OAuth exchange code already used");
  }

  consumedOAuthExchangeCodes.set(payload.jti, (payload.exp || 0) * 1000);
  return payload;
}
