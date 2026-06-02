import { randomUUID } from "crypto";
import { Server } from "socket.io";
import { RedisClientType } from "redis";
type RedisClient = RedisClientType<any, any, any>;
type RealtimeEnvelope = {
  instanceId: string;
  target: "room" | "global";
  room?: string;
  event: string;
  payload: unknown;
};

const REALTIME_CHANNEL = "mekari:realtime";
const PRESENCE_SOCKET_PREFIX = "presence:socket:";
const PRESENCE_USER_PREFIX = "presence:user:";
const PRESENCE_TTL_SECONDS = 75;

const instanceId = randomUUID();
let ioRef: Server | null = null;
let redisPub: RedisClient | null = null;
let redisSub: RedisClient | null = null;

const localPresence = new Map<string, { lastSeen: number; status: string }>();
const socketToUser = new Map<string, string>();

function emitEnvelope(envelope: RealtimeEnvelope) {
  if (!ioRef) return;
  if (envelope.target === "global") {
    ioRef.emit(envelope.event, envelope.payload);
    return;
  }
  if (envelope.room) {
    ioRef.to(envelope.room).emit(envelope.event, envelope.payload);
  }
}

async function publishEnvelope(envelope: RealtimeEnvelope) {
  emitEnvelope(envelope);
  if (!redisPub?.isOpen) return;
  try {
    await redisPub.publish(REALTIME_CHANNEL, JSON.stringify(envelope));
  } catch (err) {
    console.error("[realtime publish]", err);
  }
}

export async function initRealtime(io: Server, redisClient?: RedisClient | null) {
  ioRef = io;
  redisPub = redisClient || null;

  if (!redisClient?.isOpen) return;

  try {
    redisSub = redisClient.duplicate();
    redisSub.on("error", (err) => console.error("[realtime redis subscriber]", err.message));
    await redisSub.connect();
    await redisSub.subscribe(REALTIME_CHANNEL, (raw) => {
      try {
        const envelope = JSON.parse(raw) as RealtimeEnvelope;
        if (envelope.instanceId === instanceId) return;
        emitEnvelope(envelope);
      } catch (err) {
        console.error("[realtime subscribe]", err);
      }
    });
  } catch (err) {
    console.error("[realtime init]", err);
    redisSub = null;
  }
}

export function roomName(kind: "thread" | "dm" | "user", id: string) {
  if (kind === "thread") return `room:${id}`;
  if (kind === "dm") return `dm:${id}`;
  return `user:${id}`;
}

export function broadcastToRoom(room: string, event: string, payload: unknown) {
  return publishEnvelope({ instanceId, target: "room", room, event, payload });
}

export function broadcastGlobal(event: string, payload: unknown) {
  return publishEnvelope({ instanceId, target: "global", event, payload });
}

export function broadcastToUser(userId: string, event: string, payload: unknown) {
  return broadcastToRoom(roomName("user", userId), event, payload);
}

export function rememberSocketUser(socketId: string, userId: string) {
  socketToUser.set(socketId, userId);
}

export async function markUserPresence(socketId: string, userId: string, status: string) {
  rememberSocketUser(socketId, userId);
  const safeStatus = ["online", "offline", "away"].includes(status)
    ? status
    : "online";
  const now = Date.now();

  if (redisPub?.isOpen) {
    await redisPub.set(`${PRESENCE_SOCKET_PREFIX}${socketId}`, userId, {
      EX: PRESENCE_TTL_SECONDS,
    });
    await redisPub.set(
      `${PRESENCE_USER_PREFIX}${userId}`,
      JSON.stringify({ status: safeStatus, lastSeen: now }),
      { EX: PRESENCE_TTL_SECONDS }
    );
  } else {
    localPresence.set(userId, { status: safeStatus, lastSeen: now });
  }

  await broadcastGlobal("presence_update", { userId, status: safeStatus });
}

export async function forgetSocketPresence(socketId: string) {
  const userId = socketToUser.get(socketId);
  socketToUser.delete(socketId);
  if (!userId) return;

  if (redisPub?.isOpen) {
    await redisPub.del(`${PRESENCE_SOCKET_PREFIX}${socketId}`);
    const activeSocketKeys = await redisPub.keys(`${PRESENCE_SOCKET_PREFIX}*`);
    if (activeSocketKeys.length > 0) {
      const activeUsers = await redisPub.mGet(activeSocketKeys);
      if (activeUsers.some((activeUserId) => activeUserId === userId)) return;
    }
    await redisPub.set(
      `${PRESENCE_USER_PREFIX}${userId}`,
      JSON.stringify({ status: "offline", lastSeen: Date.now() }),
      { EX: PRESENCE_TTL_SECONDS }
    );
  } else if (Array.from(socketToUser.values()).includes(userId)) {
    return;
  }

  localPresence.set(userId, { status: "offline", lastSeen: Date.now() });
  await broadcastGlobal("presence_update", { userId, status: "offline" });
}

export function startPresenceExpiryLoop() {
  setInterval(() => {
    if (redisPub?.isOpen) return;
    const now = Date.now();
    localPresence.forEach((data, userId) => {
      if (now - data.lastSeen <= 60_000 || data.status === "offline") return;
      localPresence.set(userId, { ...data, status: "offline" });
      broadcastGlobal("presence_update", { userId, status: "offline" });
    });
  }, 30_000);
}
