import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    const first = err.errors[0];
    const field = first?.path?.join(".") || "input";
    const msg = first?.message || "Validation error";
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: { message: `${field}: ${msg}` },
    });
  }

  const status =
    typeof err.status === "number" ? err.status : StatusCodes.INTERNAL_SERVER_ERROR;
  const message = err.message || "Internal server error";

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: { message } });
}
