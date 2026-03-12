import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: "user" | "admin";
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { message: "Missing authorization" } });
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret") as {
      sub: string;
      role: "user" | "admin";
    };
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: { message: "Invalid token" } });
  }
}

