import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    const first = err.errors[0];
    const field = first?.path.join(".") || "input";
    const message = first?.message || "Validation error";
    res.status(400).json({ error: { message: `${field}: ${message}` } });
    return;
  }

  const status = typeof (err as { status?: unknown }).status === "number"
    ? ((err as { status: number }).status)
    : 500;
  const message = err instanceof Error ? err.message : "Internal server error";

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: { message } });
}
