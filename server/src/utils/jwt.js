import jwt from "jsonwebtoken";

export function signToken({ userId, role }, secret, expiresIn = "7d") {
  return jwt.sign({ sub: userId, role }, secret, { expiresIn });
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

