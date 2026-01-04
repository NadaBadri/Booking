import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function setAuthCookie(res, token) {
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(env.COOKIE_NAME, { path: "/" });
}

const registerSchema = z.object({
  name: z.string().min(1).max(80).optional().default(""),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const exists = await User.findOne({ email: data.email });
    if (exists) return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await User.create({
      name: data.name ?? "",
      email: data.email,
      passwordHash,
      role: "user",
      balance: 0,
    });

    const token = signToken({ userId: user._id.toString(), role: user.role }, env.JWT_SECRET);
    setAuthCookie(res, token);
    return res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance },
    });
  } catch (err) {
    return next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });
    if (user.isFrozen) return res.status(403).json({ message: "Account is frozen" });

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    const token = signToken({ userId: user._id.toString(), role: user.role }, env.JWT_SECRET);
    setAuthCookie(res, token);
    return res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance },
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/logout", async (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      balance: req.user.balance,
      isFrozen: req.user.isFrozen,
    },
  });
});

const updateMeSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).max(100).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "No changes submitted" });

router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const data = updateMeSchema.parse(req.body);
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (data.email && data.email !== user.email) {
      const exists = await User.findOne({ email: data.email });
      if (exists) return res.status(409).json({ message: "Email already in use" });
      user.email = data.email;
    }
    if (typeof data.name === "string") user.name = data.name;
    if (data.password) user.passwordHash = await bcrypt.hash(data.password, 10);

    await user.save();
    return res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;

