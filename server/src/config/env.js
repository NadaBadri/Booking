import dotenv from "dotenv";

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  MONGO_URI: process.env.MONGO_URI ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  COOKIE_NAME: process.env.COOKIE_NAME ?? "wallet_token",
  COOKIE_SECURE: (process.env.COOKIE_SECURE ?? "false") === "true",
  APPROVAL_THRESHOLD: Number(process.env.APPROVAL_THRESHOLD ?? 1000),
};

export function assertEnv() {
  const missing = [];
  if (!env.MONGO_URI) missing.push("MONGO_URI");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

