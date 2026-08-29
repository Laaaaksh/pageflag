import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, verifySession } from "../lib/auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? verifySession(token) : null;
  if (!session) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }
  req.userId = session.userId;
  next();
}
