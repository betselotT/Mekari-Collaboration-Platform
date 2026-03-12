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

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
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

  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);
  app.use("/api/threads", threadRouter);
  app.use("/api/gamification", gamificationRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/ai", aiRouter);

  app.use(errorHandler);

  return app;
};
