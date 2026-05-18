"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useId,
  useRef,
} from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: string | HTMLElement,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      execute: (widgetId?: string) => void;
    };
  }
}

interface CaptchaProps {
  onChange: (token: string | null) => void;
  onExpired?: () => void;
  onError?: () => void;
}

export interface CaptchaRef {
  reset: () => void;
  execute: () => void;
}

const HCAPTCHA_SCRIPT_URL =
  "https://js.hcaptcha.com/1/api.js?render=explicit";

export const Captcha = forwardRef<CaptchaRef, CaptchaProps>(
  ({ onChange, onExpired, onError }, ref) => {
    const containerId = useId().replace(/:/g, "");

    const widgetIdRef = useRef<string | null>(null);

    const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

    const isCaptchaConfigured =
      siteKey && siteKey !== "your-hcaptcha-site-key";

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (window.hcaptcha && widgetIdRef.current) {
          window.hcaptcha.reset(widgetIdRef.current);
        }
      },

      execute: () => {
        if (window.hcaptcha && widgetIdRef.current) {
          window.hcaptcha.execute(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      if (!isCaptchaConfigured) {
        return;
      }

      let cancelled = false;

      const hcaptchaSiteKey = siteKey;

      function renderWidget() {
        if (
          cancelled ||
          !window.hcaptcha ||
          widgetIdRef.current
        ) {
          return;
        }

        const container = document.getElementById(containerId);

        if (!container) {
          return;
        }

        widgetIdRef.current = window.hcaptcha.render(container, {
          sitekey: hcaptchaSiteKey,
          callback: onChange,
          "expired-callback": onExpired,
          "error-callback": onError,
          theme: "light",
        });
      }

      if (window.hcaptcha) {
        renderWidget();

        return () => {
          cancelled = true;
        };
      }

      const existingScript =
        document.querySelector<HTMLScriptElement>(
          `script[src="${HCAPTCHA_SCRIPT_URL}"]`
        );

      if (existingScript) {
        existingScript.addEventListener("load", renderWidget);

        return () => {
          cancelled = true;

          existingScript.removeEventListener(
            "load",
            renderWidget
          );
        };
      }

      const script = document.createElement("script");

      script.src = HCAPTCHA_SCRIPT_URL;
      script.async = true;
      script.defer = true;

      script.addEventListener("load", renderWidget);

      script.addEventListener("error", () => {
        onError?.();
      });

      document.head.appendChild(script);

      return () => {
        cancelled = true;

        script.removeEventListener(
          "load",
          renderWidget
        );
      };
    }, [
      containerId,
      isCaptchaConfigured,
      onChange,
      onError,
      onExpired,
      siteKey,
    ]);

    if (!isCaptchaConfigured) {
      return (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          CAPTCHA is not configured. Add
          NEXT_PUBLIC_HCAPTCHA_SITE_KEY
          to the frontend environment.
        </p>
      );
    }

    return <div id={containerId} />;
  }
);

Captcha.displayName = "Captcha";
