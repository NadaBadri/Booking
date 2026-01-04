import { verifyToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[env.COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const payload = verifyToken(token, env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("_id name email role balance isFrozen");
    if (!user) return res.status(401).json({ message: "Invalid session" });
    if (user.isFrozen) return res.status(403).json({ message: "Account is frozen" });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Not authenticated" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  next();
}

