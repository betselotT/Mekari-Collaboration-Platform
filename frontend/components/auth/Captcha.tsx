"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";

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
    const recaptchaRef = useRef<ReCAPTCHA>(null);
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    const isCaptchaConfigured =
      siteKey && siteKey !== "your-hcaptcha-site-key";

    useImperativeHandle(ref, () => ({
      reset: () => recaptchaRef.current?.reset(),
      execute: () => recaptchaRef.current?.execute(),
    }));

    if (!siteKey || siteKey === "your-recaptcha-site-key") {
      return (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          CAPTCHA is not configured. Add NEXT_PUBLIC_RECAPTCHA_SITE_KEY to the frontend environment.
        </p>
      );
    }

    return (
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={siteKey}
        onChange={onChange}
        onExpired={onExpired}
        onErrored={onError}
        theme="light"
      />
    );
  }
);

Captcha.displayName = "Captcha";
