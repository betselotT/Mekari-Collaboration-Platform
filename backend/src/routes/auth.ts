import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User";

const router = Router();
const googleClient = new OAuth2Client();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const googleAuthSchema = z.object({
  credential: z.string().min(10),
});

function signAuthToken(userId: string, role: string) {
  return jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: parsed.email });
    if (existing) {
      return res.status(409).json({ error: { message: "Email already in use" } });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const user = await User.create({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
    });

    const token = signAuthToken(user.id, user.role);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
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

    const token = signAuthToken(user.id, user.role);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
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
      user = await User.create({
        name: payload.name || payload.email.split("@")[0],
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        oauthProvider: "google",
        avatarUrl: payload.picture,
      });
    } else {
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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

export const authRouter = router;

