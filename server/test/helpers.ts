import request from "supertest";
import { pool } from "../src/db.js";
import { createApp } from "../src/app.js";

export const app = createApp();

export async function resetDb(): Promise<void> {
  await pool.query(
    "TRUNCATE users, teams, team_members, projects, pins, integrations RESTART IDENTITY CASCADE",
  );
}

export interface SignedUpContext {
  agent: ReturnType<typeof request.agent>;
  userId: string;
  teamId: string;
}

/** Signs up a fresh user + team and returns a cookie-persisting agent for authed requests. */
export async function signUp(email = "owner@example.com"): Promise<SignedUpContext> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({
    email,
    password: "hunter2-password",
    name: "Test Owner",
    teamName: "Test Team",
  });
  if (res.status !== 201) {
    throw new Error(`signup failed in test helper: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, userId: res.body.user.id as string, teamId: res.body.team.id as string };
}

export async function createProject(
  ctx: SignedUpContext,
  overrides: { name?: string; allowedDomains?: string[] } = {},
): Promise<{ id: string; publicKey: string; reviewToken: string }> {
  const res = await ctx.agent.post("/api/projects").send({
    name: overrides.name ?? "Marketing Site",
    teamId: ctx.teamId,
    allowedDomains: overrides.allowedDomains ?? [],
  });
  if (res.status !== 201) {
    throw new Error(
      `project creation failed in test helper: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return {
    id: res.body.project.id as string,
    publicKey: res.body.project.public_key as string,
    reviewToken: res.body.project.review_token as string,
  };
}

// A 1x1 transparent PNG, used as a stand-in screenshot in tests.
export const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
