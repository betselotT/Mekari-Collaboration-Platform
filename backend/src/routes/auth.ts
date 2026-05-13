import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { IUser, User } from "../models/User";

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
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  accountType: accountTypeSchema,
});

const googleAuthSchema = z.object({
  credential: z.string().min(10),
  accountType: accountTypeSchema.optional(),
});

function signAuthToken(userId: string, role: string) {
  return jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

function roleForAccountType(accountType: z.infer<typeof accountTypeSchema>) {
  return accountType === "mentor" ? "expert" : "learner";
}

function accountTypeForRole(role: string) {
  if (role === "expert" || role === "admin" || role === "mod") return "mentor";
  return "learner";
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

    const user = await User.findOne({ email: parsed.email });
    if (!user) {
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    if (!user.passwordHash) {
      return res
        .status(401)
        .json({ error: { message: "This account uses Google sign-in" } });
    }

    const valid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    if (accountTypeForRole(user.role) !== parsed.accountType) {
      return res.status(403).json({
        error: {
          message: `This account is registered as a ${accountTypeForRole(user.role)}. Choose the matching sign-in option.`,
        },
      });
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
      });
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
    });
  } catch (err) {
    next(err);
  }
});

export const authRouter = router;

