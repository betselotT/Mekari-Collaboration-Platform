import { randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";

type MeetSpaceResponse = {
  name?: string;
  meetingUri?: string;
  error?: { message?: string };
};

function createDevMeetLink() {
  const code = randomBytes(6)
    .toString("base64url")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
  return `https://meet.google.com/${code.slice(0, 3)}-${code.slice(3, 7)}-${code.slice(7, 10)}`;
}

function hasGoogleMeetConfig() {
  return Boolean(
    process.env.GOOGLE_MEET_CLIENT_ID &&
      process.env.GOOGLE_MEET_CLIENT_SECRET &&
      process.env.GOOGLE_MEET_REFRESH_TOKEN
  );
}

export async function createGoogleMeetSpace() {
  if (!hasGoogleMeetConfig()) {
    if (process.env.GOOGLE_MEET_DEV_FALLBACK === "true") {
      return { meetLink: createDevMeetLink() };
    }

    const error = new Error(
      "Google Meet is not configured. Add GOOGLE_MEET_CLIENT_ID, GOOGLE_MEET_CLIENT_SECRET, and GOOGLE_MEET_REFRESH_TOKEN."
    ) as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  const oauthClient = new OAuth2Client(
    process.env.GOOGLE_MEET_CLIENT_ID,
    process.env.GOOGLE_MEET_CLIENT_SECRET
  );
  oauthClient.setCredentials({ refresh_token: process.env.GOOGLE_MEET_REFRESH_TOKEN });

  const accessToken = await oauthClient.getAccessToken();
  if (!accessToken.token) {
    const error = new Error("Could not obtain a Google Meet access token") as Error & {
      status?: number;
    };
    error.status = 503;
    throw error;
  }

  const response = await fetch("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: {
        accessType: "OPEN",
        entryPointAccess: "ALL",
      },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as MeetSpaceResponse;
  if (!response.ok) {
    const error = new Error(data.error?.message || "Google Meet API failed to create a space") as Error & {
      status?: number;
    };
    error.status = 502;
    throw error;
  }

  if (!data.meetingUri) {
    const error = new Error("Google Meet API created a space without a meeting link") as Error & {
      status?: number;
    };
    error.status = 502;
    throw error;
  }

  return { meetLink: data.meetingUri, meetSpaceName: data.name };
}
