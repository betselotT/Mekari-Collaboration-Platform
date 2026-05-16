import rateLimit, {
  ClientRateLimitInfo,
  MemoryStore,
  Options,
  Store,
} from "express-rate-limit";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "redis";
import { AuthRequest } from "./auth";
import { logAuditEvent } from "../services/auditLog";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const readPositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MESSAGE_RATE_WINDOW_MS = readPositiveNumber(
  process.env.MESSAGE_RATE_WINDOW_MS,
  60_000
);
const MESSAGE_RATE_LIMIT = readPositiveNumber(process.env.MESSAGE_RATE_LIMIT, 10);

type RedisClient = ReturnType<typeof createClient>;

class RedisMessageRateLimitStore implements Store {
  prefix = "message-rate-limit:";
  localKeys = false;

  private windowMs = MESSAGE_RATE_WINDOW_MS;
  private redisClient: RedisClient | null = null;
  private redisConnectPromise: Promise<RedisClient | null> | null = null;
  private fallbackStore = new MemoryStore();

  init(options: Options) {
    this.windowMs = options.windowMs;
    this.fallbackStore.init(options);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const client = await this.getRedisClient();
    if (!client) {
      return this.fallbackStore.increment(key);
    }

    const redisKey = this.redisKey(key);
    const totalHits = await client.incr(redisKey);
    if (totalHits === 1) {
      await client.pExpire(redisKey, this.windowMs);
    }

    return {
      totalHits,
      resetTime: await this.getResetTime(client, redisKey),
    };
  }

  async decrement(key: string): Promise<void> {
    const client = await this.getRedisClient();
    if (!client) {
      return this.fallbackStore.decrement(key);
    }

    const redisKey = this.redisKey(key);
    const totalHits = await client.decr(redisKey);
    if (totalHits <= 0) {
      await client.del(redisKey);
    }
  }

  async resetKey(key: string): Promise<void> {
    const client = await this.getRedisClient();
    if (!client) {
      return this.fallbackStore.resetKey(key);
    }

    await client.del(this.redisKey(key));
  }

  async resetAll(): Promise<void> {
    const client = await this.getRedisClient();
    if (!client) {
      return this.fallbackStore.resetAll();
    }

    for await (const key of client.scanIterator({ MATCH: `${this.prefix}*`, COUNT: 100 })) {
      await client.del(key);
    }
  }

  async shutdown(): Promise<void> {
    if (this.redisClient?.isOpen) {
      await this.redisClient.quit();
    }
    this.fallbackStore.shutdown();
  }

  private redisKey(key: string) {
    return `${this.prefix}${key}`;
  }

  private async getResetTime(client: RedisClient, key: string) {
    const ttl = await client.pTTL(key);
    return new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
  }

  private async getRedisClient() {
    if (this.redisClient?.isOpen) {
      return this.redisClient;
    }

    if (!process.env.REDIS_URL) {
      console.warn("REDIS_URL not set. Message rate limiter is using in-memory storage.");
      return null;
    }

    if (!this.redisConnectPromise) {
      this.redisConnectPromise = this.connectRedisClient();
    }

    return this.redisConnectPromise;
  }

  private async connectRedisClient() {
    try {
      const client = createClient({ url: process.env.REDIS_URL });
      client.on("error", (err) => {
        console.error("Message rate limiter Redis client error:", err.message);
      });
      await client.connect();
      this.redisClient = client;
      return client;
    } catch (err) {
      console.error("Message rate limiter failed to connect to Redis. Falling back to memory.", err);
      this.redisClient = null;
      this.redisConnectPromise = null;
      return null;
    }
  }
}

export const messageRateLimiter = rateLimit({
  windowMs: MESSAGE_RATE_WINDOW_MS,
  max: MESSAGE_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisMessageRateLimitStore(),
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `user:${authReq.userId || "unknown"}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    const rateLimitInfo = req as typeof req & { rateLimit?: { resetTime?: Date } };
    const resetTime = rateLimitInfo.rateLimit?.resetTime;
    const secondsUntilReset = Math.max(
      1,
      Math.ceil(((resetTime?.getTime() || Date.now() + MESSAGE_RATE_WINDOW_MS) - Date.now()) / 1000)
    );
    const actionLabel = req.originalUrl.includes("/api/dms") ? "messages" : "messages/threads";

    console.warn("Message/thread rate limit exceeded", {
      userId: authReq.userId,
      ip: req.ip,
      method: req.method,
      path: req.originalUrl,
    });

    void logAuditEvent({
      actorId: authReq.userId,
      actionType: "message_rate_limit_exceeded",
      action: `Message/thread rate limit exceeded for user ${authReq.userId || req.ip}`,
      targetType: "rate_limit",
      status: "blocked",
      metadata: {
        userId: authReq.userId,
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
        userAgent: req.get("user-agent"),
        limit: MESSAGE_RATE_LIMIT,
        windowMs: MESSAGE_RATE_WINDOW_MS,
        resetTime: resetTime?.toISOString(),
      },
    });

    res.status(429).json({
      success: false,
      message: `Too many ${actionLabel}. Please try again after ${secondsUntilReset} seconds.`,
    });
  },
});
