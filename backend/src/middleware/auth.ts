import { NextFunction, Request, Response } from "express";
import { User } from "../models/User";
import { bannedAccountMessage } from "../services/accountBan";
import { readSessionToken, setSessionCookie, verifySessionToken } from "../authSession";

export type UserRole = "user" | "admin" | "learner" | "expert" | "mod";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = readSessionToken(req);
  if (!token) {
    return res.status(401).json({ error: { message: "Missing session" } });
  }

  let decoded: { sub: string; role: UserRole };
  try {
    decoded = verifySessionToken(token) as {
      sub: string;
      role: UserRole;
    };
  } catch {
    return res.status(401).json({ error: { message: "Invalid token" } });
  }

  try {
    const user = await User.findById(decoded.sub).select("role isBanned banReason").lean();
    if (!user) {
      return res.status(401).json({ error: { message: "Invalid token" } });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: { message: bannedAccountMessage(user.banReason) } });
    }
    req.userId = decoded.sub;
    req.userRole = user.role;
    setSessionCookie(res, decoded.sub, user.role);
    next();
  } catch (err) {
    next(err);
  }
}
