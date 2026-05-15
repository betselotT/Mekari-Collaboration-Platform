import rateLimit, {
  ClientRateLimitInfo,
  MemoryStore,
  Options,
  Store,
} from "express-rate-limit";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "redis";
import { logAuditEvent } from "../services/auditLog";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const readPositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const LOGIN_RATE_LIMIT_WINDOW_MS = readPositiveNumber(
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
  10 * 60 * 1000
);
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = readPositiveNumber(
  process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  5
);

type RedisClient = ReturnType<typeof createClient>;

class RedisLoginRateLimitStore implements Store {
  prefix = "login-rate-limit:";
  localKeys = false;

  private windowMs = LOGIN_RATE_LIMIT_WINDOW_MS;
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
      console.warn("REDIS_URL not set. Login rate limiter is using in-memory storage.");
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
        console.error("Login rate limiter Redis client error:", err.message);
      });
      await client.connect();
      this.redisClient = client;
      return client;
    } catch (err) {
      console.error("Login rate limiter failed to connect to Redis. Falling back to memory.", err);
      this.redisClient = null;
      this.redisConnectPromise = null;
      return null;
    }
  }
}

// Dedicated limiter for authentication attempts only. Import and apply this
// middleware directly on password and OAuth login routes.
export const loginRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisLoginRateLimitStore(),
  handler: (req, res) => {
    const rateLimitInfo = req as typeof req & { rateLimit?: { resetTime?: Date } };
    const resetTime = rateLimitInfo.rateLimit?.resetTime;
    const minutesUntilReset = Math.max(
      1,
      Math.ceil(((resetTime?.getTime() || Date.now() + LOGIN_RATE_LIMIT_WINDOW_MS) - Date.now()) / 60000)
    );

    console.warn("Login rate limit exceeded", {
      ip: req.ip,
      method: req.method,
      path: req.originalUrl,
    });

    void logAuditEvent({
      actionType: "login_rate_limit_exceeded",
      action: `Login rate limit exceeded for IP ${req.ip}`,
      targetType: "auth",
      status: "blocked",
      metadata: {
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
        userAgent: req.get("user-agent"),
        limit: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
        windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
        resetTime: resetTime?.toISOString(),
      },
    });

    res.status(429).json({
      success: false,
      message: `Too many login attempts. Please try again after ${minutesUntilReset} minutes.`,
    });
  },
});
