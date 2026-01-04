import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find().select("_id name email role balance isFrozen createdAt");
  return res.json({ users });
});

const createUserSchema = z.object({
  name: z.string().min(1).max(80).optional().default(""),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["user", "admin"]).optional().default("user"),
  balance: z.number().min(0).optional().default(0),
});

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const exists = await User.findOne({ email: data.email });
    if (exists) return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await User.create({
      name: data.name ?? "",
      email: data.email,
      passwordHash,
      role: data.role ?? "user",
      balance: data.balance ?? 0,
    });
    return res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance },
    });
  } catch (err) {
    return next(err);
  }
});

const updateUserSchema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    isFrozen: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "No changes submitted" });

router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (typeof data.role === "string") user.role = data.role;
    if (typeof data.isFrozen === "boolean") user.isFrozen = data.isFrozen;

    await user.save();
    return res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance, isFrozen: user.isFrozen },
    });
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ ok: true });
});

export default router;

