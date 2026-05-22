import crypto from "crypto";
import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

const OTP_TTL_SECONDS = 10 * 60;
const KEY_PREFIX = "email-verification-otp:";

let redisClient: RedisClient | null = null;
let redisConnectPromise: Promise<RedisClient | null> | null = null;

function redisKey(email: string) {
  const emailHash = crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
  return `${KEY_PREFIX}${emailHash}`;
}

async function connectWithTimeout(client: RedisClient) {
  const timeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 3000);
  await Promise.race([
    client.connect(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Redis connection timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function getRedisClient() {
  if (redisClient?.isOpen) return redisClient;

  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!redisConnectPromise) {
    redisConnectPromise = (async () => {
      try {
        const client = createClient({ url: process.env.REDIS_URL });
        client.on("error", (err) => {
          console.error("Email OTP Redis client error:", err.message);
        });
        await connectWithTimeout(client);
        redisClient = client;
        return client;
      } catch (err) {
        console.error("Email OTP Redis unavailable. Falling back to Mongo OTP storage.", err);
        redisClient = null;
        redisConnectPromise = null;
        return null;
      }
    })();
  }

  return redisConnectPromise;
}

export async function storeEmailOtpHash(email: string, otpHash: string) {
  const client = await getRedisClient();
  if (!client) return false;

  await client.set(redisKey(email), otpHash, { EX: OTP_TTL_SECONDS });
  return true;
}

export async function getEmailOtpHash(email: string) {
  const client = await getRedisClient();
  if (!client) return null;

  return client.get(redisKey(email));
}

export async function deleteEmailOtpHash(email: string) {
  const client = await getRedisClient();
  if (!client) return false;

  await client.del(redisKey(email));
  return true;
}
