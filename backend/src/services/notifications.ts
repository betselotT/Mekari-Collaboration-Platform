import { JWT } from "google-auth-library";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { sendNotificationEmail } from "./email";
import { broadcastToUser } from "./realtime";

export type NotificationCategory = "chat" | "documentStatus" | "moderation" | "admin";

type NotificationInput = {
  userId: string;
  category: NotificationCategory;
  type: string;
  message: string;
  link?: string;
  title?: string;
};

const DEFAULT_PUSH_TITLE = "Mekari";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function notificationEmailLink(link?: string) {
  if (!link) return undefined;
  if (/^https?:\/\//i.test(link)) return link;
  const baseUrl = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  return new URL(link, baseUrl).toString();
}

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function firebaseConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      privateKey()
  );
}

async function getFcmAccessToken() {
  const client = new JWT({
    email: process.env.FIREBASE_CLIENT_EMAIL,
    key: privateKey(),
    scopes: [FCM_SCOPE],
  });
  const token = await client.getAccessToken();
  return token.token;
}

async function sendFcmPush(tokens: string[], input: NotificationInput) {
  if (!tokens.length || !firebaseConfigured()) return;

  const accessToken = await getFcmAccessToken();
  if (!accessToken) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  await Promise.allSettled(
    tokens.map((token) =>
      fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: input.title || DEFAULT_PUSH_TITLE,
              body: input.message,
            },
            webpush: {
              fcmOptions: {
                link: input.link || "/dashboard",
              },
            },
            data: {
              type: input.type,
              category: input.category,
              link: input.link || "",
            },
          },
        }),
      })
    )
  );
}

export async function createNotification(input: NotificationInput) {
  const user = await User.findById(input.userId).select(
    "name email emailVerified notificationPreferences pushTokens"
  );
  if (!user) return null;

  const categoryPreferences = user.notificationPreferences?.[input.category];
  const internalEnabled = categoryPreferences?.internal ?? true;
  const pushEnabled = categoryPreferences?.push ?? false;
  const emailEnabled = categoryPreferences?.email ?? false;
  let notif = null;

  if (internalEnabled) {
    notif = await Notification.create({
      userId: input.userId,
      type: input.type,
      message: input.message,
      link: input.link || "",
      read: false,
    });

    await broadcastToUser(input.userId, "notification", {
      id: String(notif._id),
      _id: String(notif._id),
      type: notif.type,
      message: notif.message,
      link: notif.link,
      read: false,
      createdAt: notif.createdAt,
    });
  }

  if (pushEnabled) {
    const tokens = (user.pushTokens || []).map((item) => item.token).filter(Boolean);
    await sendFcmPush(tokens, input);
  }

  if (emailEnabled && user.emailVerified) {
    await sendNotificationEmail({
      to: user.email,
      name: user.name,
      title: input.title || DEFAULT_PUSH_TITLE,
      message: input.message,
      link: notificationEmailLink(input.link),
    }).catch((err) => {
      console.error(`Failed to send notification email to ${user.email}`, err);
    });
  }

  return notif;
}

export async function notifyAdmins(input: Omit<NotificationInput, "userId" | "category">) {
  const admins = await User.find({ role: { $in: ["admin", "mod"] } }).select("_id");
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        ...input,
        userId: String(admin._id),
        category: "admin",
      })
    )
  );
}
