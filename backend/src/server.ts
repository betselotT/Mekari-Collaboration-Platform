import "./config/env";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { createClient } from "redis";
import { createApp } from "./app";
import { setIo } from "./sockets/ioInstance";
import { registerChatHandlers } from "./sockets/chat";
import { initRealtime, startPresenceExpiryLoop } from "./services/realtime";
import { syncClassDiagramCollections } from "./config/classDiagramCollections";

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mekari";
const REDIS_URL = process.env.REDIS_URL;
const FRONTEND_ORIGINS = [
  process.env.FRONTEND_ORIGIN,
  ...(process.env.FRONTEND_ORIGINS || "").split(","),
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]
  .map((origin) => origin?.trim())
  .filter(Boolean) as string[];

async function connectRedisWithTimeout(redisClient: ReturnType<typeof createClient>) {
  const timeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 3000);
  await Promise.race([
    redisClient.connect(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Redis connection timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function bootstrap() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
    await syncClassDiagramCollections();

    let redisClient: ReturnType<typeof createClient> | null = null;
    if (REDIS_URL) {
      try {
        redisClient = createClient({ url: REDIS_URL });
        redisClient.on("error", (err) =>
          console.error("Redis client error:", err.message)
        );
        await connectRedisWithTimeout(redisClient);
        console.log("Connected to Redis");
      } catch (err) {
        console.error("Failed to connect to Redis. Continuing without Redis.", err);
        if (redisClient?.isOpen) {
          await redisClient.quit().catch(() => undefined);
        }
        redisClient = null;
      }
    } else {
      console.warn("REDIS_URL not set. Continuing without Redis.");
    }

    const app = createApp();
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: [...new Set(FRONTEND_ORIGINS)],
        credentials: true,
      },
    });

    // Make io available to route handlers via the singleton
    setIo(io);
    await initRealtime(io, redisClient);
    startPresenceExpiryLoop();
    registerChatHandlers(io, redisClient);

    server.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to bootstrap server", err);
    process.exit(1);
  }
}

bootstrap();
