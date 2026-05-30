"use client";

import { apiClient } from "./api";

declare global {
  interface Window {
    firebase?: any;
  }
}

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const FIREBASE_SCRIPTS = {
  app: "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js",
  messaging:
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js",
};

function hasFirebaseConfig() {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.projectId &&
      FIREBASE_CONFIG.messagingSenderId &&
      FIREBASE_CONFIG.appId &&
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  );
}

function isPushNotificationSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);

    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement("script");

    script.src = src;
    script.async = true;

    script.onload = () => resolve();

    script.onerror = () =>
      reject(new Error(`Failed to load ${src}`));

    document.head.appendChild(script);
  });
}

async function loadFirebaseMessaging() {
  await loadScript(FIREBASE_SCRIPTS.app);

  await loadScript(FIREBASE_SCRIPTS.messaging);

  if (!window.firebase.apps?.length) {
    window.firebase.initializeApp(FIREBASE_CONFIG);
  }

  return window.firebase.messaging();
}

export async function registerForPushNotifications() {
  if (!isPushNotificationSupported()) {
    return {
      ok: false,
      reason: "Push notifications are not supported in this browser.",
    };
  }

  if (!hasFirebaseConfig()) {
    return {
      ok: false,
      reason: "Firebase web push is not configured.",
    };
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    return {
      ok: false,
      reason: "Push notification permission was not granted.",
    };
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    const messaging = await loadFirebaseMessaging();

    const token = await messaging.getToken({
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return {
        ok: false,
        reason: "Firebase did not return a push token.",
      };
    }

    await apiClient.post("/api/notifications/push-token", {
      token,
    });

    window.localStorage.setItem("mekari_fcm_token", token);

    return {
      ok: true,
      token,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Firebase error";

    return {
      ok: false,
      reason: `Firebase push setup failed. Make sure this browser can load https://www.gstatic.com and try again. Details: ${message}`,
    };
  }
}
