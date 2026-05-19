import "../config/env";

type RecaptchaSiteVerifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

function isCaptchaBypassEnabled() {
  return process.env.CAPTCHA_BYPASS_ENABLED === "true";
}

export async function verifyCaptchaToken(token?: string) {
  if (isCaptchaBypassEnabled()) {
    const bypassToken = process.env.CAPTCHA_BYPASS_TOKEN || "dev-bypass";
    if (!token || token === bypassToken) {
      return;
    }
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!token) {
    throw Object.assign(new Error("captchaToken is required"), {
      status: 400,
    });
  }

  if (!secret || secret === "your-recaptcha-secret-key") {
    throw Object.assign(new Error("RECAPTCHA_SECRET_KEY is not configured"), {
      status: 500,
    });
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw Object.assign(new Error("CAPTCHA verification service is unavailable"), {
      status: 502,
    });
  }

  const result = (await response.json()) as RecaptchaSiteVerifyResponse;

  if (!result.success) {
    throw Object.assign(new Error("CAPTCHA verification failed"), {
      status: 400,
    });
  }
}
