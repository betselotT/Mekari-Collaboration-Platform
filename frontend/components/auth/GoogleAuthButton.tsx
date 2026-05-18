"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

type GoogleAuthButtonProps = {
  onCredential: (credential: string) => Promise<void> | void;
  onError?: (message: string) => void;
};

export function GoogleAuthButton({ onCredential, onError }: GoogleAuthButtonProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [hasClientId, setHasClientId] = useState(false);
  const [canUseGoogle, setCanUseGoogle] = useState(true);
  const mountedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const rawClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const clientId = rawClientId.trim().replace(/^"(.*)"$/, "$1");
    if (!clientId || clientId === "your-google-oauth-client-id.apps.googleusercontent.com") {
      return;
    }
    setHasClientId(true);

    const origin = window.location.origin;
    const allowedOrigins = (process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const isLocalOrigin = origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");

    if (allowedOrigins.length > 0) {
      setCanUseGoogle(allowedOrigins.includes(origin));
      return;
    }

    setCanUseGoogle(!isLocalOrigin);
  }, []);

  useEffect(() => {
    if (!canUseGoogle) return;
    if (window.google?.accounts?.id) {
      setScriptReady(true);
    }
  }, [canUseGoogle]);

  useEffect(() => {
    if (!scriptReady || !canUseGoogle) return;
    const rawClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const clientId = rawClientId.trim().replace(/^"(.*)"$/, "$1");
    if (!clientId) {
      onError?.("Google sign-in is not configured (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID)");
      return;
    }

    const google = window.google;
    if (!google?.accounts?.id || !containerRef.current) return;

    google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: { credential?: string }) => {
        if (!response.credential) {
          onError?.("Google did not return a credential");
          return;
        }
        await onCredential(response.credential);
      },
    });

    containerRef.current.innerHTML = "";
    google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: "320",
    });
  }, [scriptReady, canUseGoogle, onCredential, onError]);

  useEffect(() => {
    const onGlobalError = (event: ErrorEvent) => {
      const msg = String(event.message || "");
      if (msg.includes("origin is not allowed")) {
        const currentOrigin = window.location.origin;
        const rawClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
        const clientId = rawClientId.trim().replace(/^"(.*)"$/, "$1");
        onError?.(
          `Google blocked this origin. Origin: ${currentOrigin}. Client ID in app: ${clientId}. Add this exact origin to Authorized JavaScript origins in Google Cloud.`
        );
      }
    };
    window.addEventListener("error", onGlobalError);
    return () => window.removeEventListener("error", onGlobalError);
  }, [onError]);

  return (
    <div className="space-y-2">
      {!hasClientId && (
        <button
          type="button"
          onClick={() =>
            onError?.("Google sign-in is not configured (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID)")
          }
          className="flex w-full items-center justify-center rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Continue with Google
        </button>
      )}
      {hasClientId && !canUseGoogle && (
        <button
          type="button"
          onClick={() => {
            const currentOrigin = window.location.origin;
            onError?.(
              `Google is configured, but this origin is not allowed: ${currentOrigin}. Add it to Authorized JavaScript origins in Google Cloud or set NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS.`
            );
          }}
          className="flex w-full items-center justify-center rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Continue with Google
        </button>
      )}
      {hasClientId && canUseGoogle && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => {
            if (mountedRef.current) setScriptReady(true);
          }}
          onLoad={() => {
            if (mountedRef.current) setScriptReady(true);
          }}
        />
      )}
      <div ref={containerRef} />
    </div>
  );
}

