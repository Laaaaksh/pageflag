import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db.js";
import { hashPassword, signSession, verifyPassword, SESSION_COOKIE } from "../lib/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { Team, User } from "../types.js";

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "password must be at least 8 characters"),
  name: z.string().min(1),
  teamName: z.string().min(1),
});

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      return;
    }
    const { email, password, name, teamName } = parsed.data;

    const existing = await query<User>("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "an account with that email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: userRows } = await client.query<User>(
        "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *",
        [email.toLowerCase(), passwordHash, name],
      );
      const user = userRows[0];
      const { rows: teamRows } = await client.query<Team>(
        "INSERT INTO teams (name) VALUES ($1) RETURNING *",
        [teamName],
      );
      const team = teamRows[0];
      await client.query(
        "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')",
        [team.id, user.id],
      );
      await client.query("COMMIT");

      const token = signSession({ userId: user.id });
      res.cookie(SESSION_COOKIE, token, cookieOptions);
      res.status(201).json({ user: { id: user.id, email: user.email, name: user.name }, team });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }),
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid input" });
      return;
    }
    const { email, password } = parsed.data;

    const { rows } = await query<User>("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: "invalid email or password" });
      return;
    }

    const token = signSession({ userId: user.id });
    res.cookie(SESSION_COOKIE, token, cookieOptions);
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  }),
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query<User>("SELECT * FROM users WHERE id = $1", [req.userId]);
    const user = rows[0];
    if (!user) {
      res.status(401).json({ error: "not authenticated" });
      return;
    }
    const { rows: teams } = await query<Team>(
      `SELECT t.* FROM teams t JOIN team_members tm ON tm.team_id = t.id WHERE tm.user_id = $1`,
      [user.id],
    );
    res.json({ user: { id: user.id, email: user.email, name: user.name }, teams });
  }),
);
