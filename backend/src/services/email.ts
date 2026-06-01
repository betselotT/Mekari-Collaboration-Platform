import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import dns from "dns/promises";

type OtpEmailInput = {
  to: string;
  name: string;
  otp: string;
};

type NotificationEmailInput = {
  to: string;
  name: string;
  title: string;
  message: string;
  link?: string;
};

async function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) return null;

  let smtpHost = host;
  if (process.env.SMTP_FORCE_IPV4 !== "false") {
    const addresses = await dns.resolve4(host).catch(() => []);
    smtpHost = addresses[0] || host;
  }

  const options: SMTPTransport.Options = {
    host: smtpHost,
    port,
    secure: port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: smtpHost !== host ? { servername: host } : undefined,
    auth: user && pass ? { user, pass } : undefined,
  };

  return nodemailer.createTransport(options);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendVerificationOtpEmail({ to, name, otp }: OtpEmailInput) {
  const from = process.env.EMAIL_FROM || "Mekari <no-reply@mekari.local>";
  const transport = await getTransport();

  if (process.env.EMAIL_DEV_LOG_ONLY === "true") {
    console.log(`[email] EMAIL_DEV_LOG_ONLY=true. Verification OTP for ${to}: ${otp}`);
    return;
  }

  if (!transport) {
    console.log(`[email] SMTP_HOST is not configured. Verification OTP for ${to}: ${otp}`);
    return;
  }

  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otp);

  await transport.sendMail({
    from,
    to,
    subject: "Your Mekari verification code",
    text: [
      `Hi ${name},`,
      "",
      `Your Mekari verification code is ${otp}.`,
      "",
      "This code expires in 10 minutes. If you did not create this account, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#171717">
        <p>Hi ${safeName},</p>
        <p>Your Mekari verification code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${safeOtp}</p>
        <p>This code expires in 10 minutes. If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendNotificationEmail({
  to,
  name,
  title,
  message,
  link,
}: NotificationEmailInput) {
  const from = process.env.EMAIL_FROM || "Mekari <no-reply@mekari.local>";
  const transport = await getTransport();
  const subject = title || "Mekari notification";

  if (process.env.EMAIL_DEV_LOG_ONLY === "true") {
    console.log(`[email] EMAIL_DEV_LOG_ONLY=true. Notification for ${to}: ${subject} - ${message}`);
    return;
  }

  if (!transport) {
    console.log(`[email] SMTP_HOST is not configured. Notification for ${to}: ${subject} - ${message}`);
    return;
  }

  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const safeLink = link ? escapeHtml(link) : "";

  await transport.sendMail({
    from,
    to,
    subject,
    text: [
      `Hi ${name},`,
      "",
      message,
      ...(link ? ["", `Open in Mekari: ${link}`] : []),
      "",
      "You can change email notification preferences from your Mekari profile.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#171717">
        <p>Hi ${safeName},</p>
        <h2 style="font-size:18px;margin:0 0 12px">${safeTitle}</h2>
        <p>${safeMessage}</p>
        ${
          safeLink
            ? `<p><a href="${safeLink}" style="color:#4f46e5">Open in Mekari</a></p>`
            : ""
        }
        <p style="font-size:12px;color:#737373">You can change email notification preferences from your Mekari profile.</p>
      </div>
    `,
  });
}
