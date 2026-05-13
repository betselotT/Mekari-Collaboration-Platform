import { NextFunction, Request, Response } from "express";

export function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const expectedKey = process.env.ADMIN_API_KEY?.trim();
  if (!expectedKey) {
    next();
    return;
  }

  const providedKey = req.header("x-admin-api-key");
  if (providedKey !== expectedKey) {
    res.status(401).json({ error: { message: "Invalid admin API key" } });
    return;
  }

  next();
}
