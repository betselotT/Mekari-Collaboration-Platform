import { Router } from "express";
import { z } from "zod";
import {
  adminPassword,
  adminUsername,
  clearAdminSessionCookie,
  readCookie,
  ADMIN_SESSION_COOKIE,
  adminSessionToken,
  setAdminSessionCookie,
} from "../auth";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);

    if (parsed.username !== adminUsername() || parsed.password !== adminPassword()) {
      res.status(401).json({ error: { message: "Invalid admin credential" } });
      return;
    }

    setAdminSessionCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req, res) => {
  clearAdminSessionCookie(res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  res.json({
    authenticated: readCookie(req, ADMIN_SESSION_COOKIE) === adminSessionToken(),
  });
});

export const authRouter = router;
