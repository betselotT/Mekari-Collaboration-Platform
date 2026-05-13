import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { json, urlencoded } from "express";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/users";
import { threadRouter } from "./routes/threads";
import { gamificationRouter } from "./routes/gamification";
import { analyticsRouter } from "./routes/analytics";
import { aiRouter } from "./routes/ai";
import { matchingRouter } from "./routes/matching";
import { notificationRouter } from "./routes/notifications";
import { searchRouter } from "./routes/search";
import { reportRouter } from "./routes/reports";
import { adminRouter } from "./routes/admin";
import { intelligenceRouter } from "./routes/intelligence";
import swaggerUi from "swagger-ui-express";
import { createOpenApiSpec } from "./swagger";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);

  const allowedOrigins = new Set(
    [
      process.env.FRONTEND_ORIGIN,
      ...(process.env.FRONTEND_ORIGINS || "").split(","),
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]
      .map((origin) => origin?.trim())
      .filter(Boolean)
  );

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
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  });
  app.use(limiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(createOpenApiSpec()));

  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);
  app.use("/api/threads", threadRouter);
  app.use("/api/gamification", gamificationRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/matching", matchingRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/reports", reportRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/intelligence", intelligenceRouter);

  app.use(errorHandler);

  return app;
};
