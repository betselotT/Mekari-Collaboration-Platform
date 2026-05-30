import { Router } from "express";
import { z } from "zod";
import { verifyCaptchaToken } from "../services/captcha";

const router = Router();

const verifyCaptchaSchema = z.object({
  captchaToken: z.string().min(1),
});

router.post("/verify-captcha", async (req, res, next) => {
  try {
    const parsed = verifyCaptchaSchema.parse(req.body);
    await verifyCaptchaToken(parsed.captchaToken);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export const securityRouter = router;
