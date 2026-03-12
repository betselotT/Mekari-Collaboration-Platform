import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

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

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );

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

    const valid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: { message: "Invalid credentials" } });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );

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

