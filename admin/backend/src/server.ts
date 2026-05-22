import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import path from "path";
import { connectDb } from "./db";
import { requireAdminSession } from "./auth";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { requireAdminKey } from "./middleware/adminAuth";
import { errorHandler } from "./middleware/errorHandler";
import { ADMIN_FRONTEND_ORIGINS } from "./config/origins";

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../backend/.env") });

const port = Number(process.env.PORT || process.env.ADMIN_PORT || 4100);

async function bootstrap() {
  const app = express();
  const allowedOrigins = new Set(
    [
      process.env.ADMIN_FRONTEND_ORIGIN,
      ...(process.env.ADMIN_FRONTEND_ORIGINS || "").split(","),
      ...ADMIN_FRONTEND_ORIGINS,
    ]
      .map((origin) => origin?.trim())
      .filter(Boolean)
  );

  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    })
  );

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      database:
        mongoose.connection.readyState === 1
          ? "connected"
          : mongoose.connection.readyState === 2
            ? "connecting"
            : "disconnected",
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin", requireAdminSession);
  app.use("/api/admin", (_req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      res.status(503).json({
        error: {
          message: "Admin database is not connected yet. Check MONGO_URI and network access.",
        },
      });
      return;
    }
    next();
  });
  app.use("/api/admin", requireAdminKey, adminRouter);
  app.use(errorHandler);

  app.listen(port, () => {
    console.log(`Admin backend listening on port ${port}`);
  });

  connectDb().catch((err) => {
    console.error("Admin backend failed to connect to MongoDB", err);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start admin backend", err);
  process.exit(1);
});
