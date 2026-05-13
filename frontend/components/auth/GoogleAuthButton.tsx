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
  const [debugInfo, setDebugInfo] = useState<string>("");
  const mountedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!scriptReady) return;
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
    const currentOrigin = window.location.origin;
    setDebugInfo(`origin=${currentOrigin} | clientId=${clientId}`);
    console.log("[GoogleAuthButton] initialized", {
      origin: currentOrigin,
      clientId,
    });
    console.info("[GoogleAuthButton] initialized", {
      origin: currentOrigin,
      clientId,
    });
  }, [scriptReady, onCredential, onError]);

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
      <div ref={containerRef} />
    </div>
  );
}

