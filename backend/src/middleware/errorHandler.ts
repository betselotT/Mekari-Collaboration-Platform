import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

// Centralized error handler to keep responses consistent
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status =
    typeof err.status === "number" ? err.status : StatusCodes.INTERNAL_SERVER_ERROR;
  const message = err.message || "Internal server error";

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: {
      message,
    },
  });
}

