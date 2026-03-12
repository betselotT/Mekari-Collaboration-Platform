import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { createClient } from "redis";
import { createApp } from "./app";
import { registerChatHandlers } from "./sockets/chat";

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mekari";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function bootstrap() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const redisClient = createClient({ url: REDIS_URL });
    redisClient.on("error", (err) =>
      console.error("Redis client error:", err.message)
    );
    await redisClient.connect();
    console.log("Connected to Redis");

    const app = createApp();
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
        credentials: true,
      },
    });

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
