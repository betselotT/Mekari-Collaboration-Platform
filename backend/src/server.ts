import http from "http";
import path from "path";
import dotenv from "dotenv";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { createClient } from "redis";
import { createApp } from "./app";
import { setIo } from "./sockets/ioInstance";
import { registerChatHandlers } from "./sockets/chat";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mekari";
const REDIS_URL = process.env.REDIS_URL;

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
        origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
        credentials: true,
      },
    });

    // Make io available to route handlers via the singleton
    setIo(io);
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
