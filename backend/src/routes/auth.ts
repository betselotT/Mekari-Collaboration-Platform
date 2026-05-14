import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { IUser, User } from "../models/User";
import { verifyCaptchaToken } from "../services/captcha";

const router = Router();
const googleClient = new OAuth2Client();

const accountTypeSchema = z.enum(["learner", "mentor"]);
const expertiseSchema = z.object({
  subject: z.string().min(1),
  proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]),
});
const verificationDocumentSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024),
  dataUrl: z.string().startsWith("data:").max(7_000_000),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  accountType: accountTypeSchema,
  primaryTechnicalField: z.string().min(1),
  roleOrStatus: z.string().min(1),
  yearsOfExperience: z.string().min(1),
  devicesUsed: z.array(z.string().min(1)).default([]),
  collaborationGoals: z.string().max(500).optional(),
  expertise: z.array(expertiseSchema).default([]),
  skillTags: z.array(z.string().min(1)).default([]),
  availabilityStatus: z
    .enum(["online", "busy", "offline", "in_session"])
    .default("offline"),
  verificationDocument: verificationDocumentSchema.optional(),
  captchaToken: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  accountType: accountTypeSchema,
  captchaToken: z.string().min(1),
});

const googleAuthSchema = z.object({
  credential: z.string().min(10),
  accountType: accountTypeSchema.optional(),
});

const githubStartSchema = z.object({
  accountType: accountTypeSchema.default("learner"),
  mode: z.enum(["login", "register"]).default("login"),
});

type OAuthState = {
  accountType: z.infer<typeof accountTypeSchema>;
  mode: "login" | "register";
};

function signAuthToken(userId: string, role: string) {
  return jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

function signOAuthState(state: OAuthState) {
  return jwt.sign(state, process.env.JWT_SECRET || "dev-secret", { expiresIn: "10m" });
}

function verifyOAuthState(state: string): OAuthState {
  const decoded = jwt.verify(state, process.env.JWT_SECRET || "dev-secret") as OAuthState;
  return {
    accountType: accountTypeSchema.parse(decoded.accountType),
    mode: z.enum(["login", "register"]).parse(decoded.mode),
  };
}

function frontendUrl(path: string, params?: Record<string, string>) {
  const baseUrl = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  return url.toString();
}

function roleForAccountType(accountType: z.infer<typeof accountTypeSchema>) {
  return accountType === "mentor" ? "expert" : "learner";
}

function accountTypeForRole(role: string) {
  if (role === "expert" || role === "admin" || role === "mod") return "mentor";
  return "learner";
}

function isMatchingAccountType(role: string, accountType: z.infer<typeof accountTypeSchema>) {
  if (accountType === "learner") return role === "learner" || role === "user";
  return role === "expert" || role === "admin" || role === "mod";
}

function serializeUser(user: IUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    expertVerification: user.expertVerification,
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);

    await verifyCaptchaToken(parsed.captchaToken);

    const existing = await User.findOne({ email: parsed.email });
    if (existing) {
      return res.status(409).json({ error: { message: "Email already in use" } });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const isMentor = parsed.accountType === "mentor";
    if (isMentor && parsed.expertise.length === 0) {
      return res
        .status(400)
        .json({ error: { message: "Mentors must add at least one expertise area" } });
    }
    if (isMentor && !parsed.verificationDocument) {
      return res
        .status(400)
        .json({ error: { message: "Mentors must upload a verification document" } });
    }

    const user = await User.create({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: roleForAccountType(parsed.accountType),
      primaryTechnicalField: parsed.primaryTechnicalField,
      roleOrStatus: parsed.roleOrStatus,
      yearsOfExperience: parsed.yearsOfExperience,
      devicesUsed: parsed.devicesUsed,
      collaborationGoals: parsed.collaborationGoals,
      expertise: isMentor ? parsed.expertise : [],
      skillTags: isMentor ? parsed.skillTags : [],
      availabilityStatus: isMentor ? parsed.availabilityStatus : "offline",
      expertVerification: isMentor
        ? {
            status: "pending",
            document: {
              ...parsed.verificationDocument,
              uploadedAt: new Date(),
            },
            submittedAt: new Date(),
          }
        : { status: "not_required" },
      profileSetupCompleted: true,
    });

    const token = signAuthToken(user.id, user.role);

    res.json({
      user: serializeUser(user),
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);

    await verifyCaptchaToken(parsed.captchaToken);

    const user = await User.findOne({ email: parsed.email });
    if (!user) {
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    if (!user.passwordHash) {
      return res
        .status(401)
        .json({ error: { message: `This account uses ${user.oauthProvider || "OAuth"} sign-in` } });
    }

    const valid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    if (!isMatchingAccountType(user.role, parsed.accountType)) {
      return res.status(403).json({
        error: {
          message: `This account is registered as a ${accountTypeForRole(user.role)}. Choose the matching sign-in option.`,
        },
      });
    }

    if (user.role === "user" && parsed.accountType === "learner") {
      user.role = "learner";
      await user.save();
    }

    const token = signAuthToken(user.id, user.role);

    res.json({
      user: serializeUser(user),
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

router.post("/google", async (req, res, next) => {
  try {
    const parsed = googleAuthSchema.parse(req.body);
    const allowedAudiences = (process.env.GOOGLE_CLIENT_ID || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (allowedAudiences.length === 0) {
      return res
        .status(500)
        .json({ error: { message: "GOOGLE_CLIENT_ID is not configured" } });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.credential,
      audience: allowedAudiences,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      return res.status(401).json({ error: { message: "Invalid Google token" } });
    }

    let user = await User.findOne({ email: payload.email.toLowerCase() });
    let isNewUser = false;
    if (!user) {
      const accountType = parsed.accountType || "learner";
      if (accountType === "mentor") {
        return res.status(400).json({
          error: {
            message: "Mentor Google sign-up requires a verification document. Use the mentor registration form.",
          },
        });
      }
      user = await User.create({
        name: payload.name || payload.email.split("@")[0],
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        oauthProvider: "google",
        avatarUrl: payload.picture,
        role: roleForAccountType(accountType),
        expertVerification: { status: "not_required" },
        profileSetupCompleted: false,
      });
      isNewUser = true;
    } else {
      if (parsed.accountType && accountTypeForRole(user.role) !== parsed.accountType) {
        return res.status(403).json({
          error: {
            message: `This Google account is registered as a ${accountTypeForRole(user.role)}. Choose the matching sign-in option.`,
          },
        });
      }
      user.googleId = payload.sub;
      user.oauthProvider = "google";
      if (!user.avatarUrl && payload.picture) {
        user.avatarUrl = payload.picture;
      }
      if ((!user.name || user.name.trim().length === 0) && payload.name) {
        user.name = payload.name;
      }
      await user.save();
    }

    const token = signAuthToken(user.id, user.role);

    res.json({
      user: serializeUser(user),
      token,
      isNewUser,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/github/start", (req, res, next) => {
  try {
    const parsed = githubStartSchema.parse(req.query);
    if (parsed.accountType === "mentor" && parsed.mode === "register") {
      return res.redirect(
        frontendUrl("/register", {
          error: "GitHub mentor sign-up requires a verification document.",
        })
      );
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.redirect(frontendUrl("/login", { error: "GitHub OAuth is not configured." }));
    }

    const callbackUrl =
      process.env.GITHUB_CALLBACK_URL ||
      `${process.env.PUBLIC_API_BASE_URL || "http://localhost:4000"}/api/auth/github/callback`;
    const githubUrl = new URL("https://github.com/login/oauth/authorize");
    githubUrl.searchParams.set("client_id", clientId);
    githubUrl.searchParams.set("redirect_uri", callbackUrl);
    githubUrl.searchParams.set("scope", "read:user user:email");
    githubUrl.searchParams.set("state", signOAuthState(parsed));

    res.redirect(githubUrl.toString());
  } catch (err) {
    next(err);
  }
});

router.get("/github/callback", async (req, res, next) => {
  try {
    const code = z.string().min(1).parse(req.query.code);
    const state = verifyOAuthState(z.string().min(1).parse(req.query.state));
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.redirect(frontendUrl("/login", { error: "GitHub OAuth is not configured." }));
    }

    const callbackUrl =
      process.env.GITHUB_CALLBACK_URL ||
      `${process.env.PUBLIC_API_BASE_URL || "http://localhost:4000"}/api/auth/github/callback`;
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
    if (!tokenData.access_token) {
      return res.redirect(
        frontendUrl("/login", {
          error: tokenData.error_description || "GitHub did not return an access token.",
        })
      );
    }

    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Mekari-Collaboration-Platform",
    };
    const [profileRes, emailsRes] = await Promise.all([
      fetch("https://api.github.com/user", { headers }),
      fetch("https://api.github.com/user/emails", { headers }),
    ]);
    const profile = (await profileRes.json()) as {
      id?: number;
      login?: string;
      name?: string;
      avatar_url?: string;
      email?: string | null;
    };
    const emails = (await emailsRes.json().catch(() => [])) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    const primaryEmail =
      emails.find((email) => email.primary && email.verified)?.email ||
      emails.find((email) => email.verified)?.email ||
      profile.email;

    if (!profile.id || !primaryEmail) {
      return res.redirect(
        frontendUrl("/login", {
          error: "GitHub account must expose a verified email address.",
        })
      );
    }

    let user = await User.findOne({
      $or: [{ email: primaryEmail.toLowerCase() }, { githubId: String(profile.id) }],
    });
    let isNewUser = false;

    if (!user) {
      if (state.accountType === "mentor") {
        return res.redirect(
          frontendUrl("/register", {
            error: "Mentor GitHub sign-up requires a verification document.",
          })
        );
      }
      user = await User.create({
        name: profile.name || profile.login || primaryEmail.split("@")[0],
        email: primaryEmail.toLowerCase(),
        githubId: String(profile.id),
        oauthProvider: "github",
        avatarUrl: profile.avatar_url,
        role: roleForAccountType(state.accountType),
        expertVerification: { status: "not_required" },
        profileSetupCompleted: false,
      });
      isNewUser = true;
    } else {
      if (accountTypeForRole(user.role) !== state.accountType) {
        return res.redirect(
          frontendUrl("/login", {
            error: `This GitHub account is registered as a ${accountTypeForRole(user.role)}.`,
          })
        );
      }
      user.githubId = String(profile.id);
      user.oauthProvider = "github";
      if (!user.avatarUrl && profile.avatar_url) user.avatarUrl = profile.avatar_url;
      if ((!user.name || user.name.trim().length === 0) && (profile.name || profile.login)) {
        user.name = profile.name || profile.login || user.name;
      }
      await user.save();
    }

    if (isNewUser && state.mode === "register") {
      return res.redirect(frontendUrl("/login", { registered: "github" }));
    }

    const token = signAuthToken(user.id, user.role);
    res.redirect(frontendUrl("/oauth/callback", { token }));
  } catch (err) {
    next(err);
  }
});

export const authRouter = router;

