import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app, resetDb } from "./helpers.js";

describe("auth", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("signs up a new user and team", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "new@example.com",
      password: "correct-horse-battery",
      name: "New User",
      teamName: "Acme",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("new@example.com");
    expect(res.body.team.name).toBe("Acme");
    expect(res.headers["set-cookie"]?.[0]).toMatch(/pageflag_session=/);
  });

  it("rejects a signup with too short a password", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "new@example.com",
      password: "short",
      name: "New User",
      teamName: "Acme",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    const payload = {
      email: "dup@example.com",
      password: "correct-horse-battery",
      name: "First",
      teamName: "Acme",
    };
    await request(app).post("/api/auth/signup").send(payload);
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...payload, name: "Second" });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    await request(app).post("/api/auth/signup").send({
      email: "login@example.com",
      password: "correct-horse-battery",
      name: "Login User",
      teamName: "Acme",
    });

    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "wrong-password" });
    expect(wrong.status).toBe(401);

    const right = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "correct-horse-battery" });
    expect(right.status).toBe(200);
    expect(right.headers["set-cookie"]?.[0]).toMatch(/pageflag_session=/);
  });

  it("rejects /me without a session and returns the user with one", async () => {
    const anonymous = await request(app).get("/api/auth/me");
    expect(anonymous.status).toBe(401);

    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({
      email: "me@example.com",
      password: "correct-horse-battery",
      name: "Me User",
      teamName: "Acme",
    });
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("me@example.com");
    expect(me.body.teams).toHaveLength(1);
  });

  it("clears the session on logout", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({
      email: "logout@example.com",
      password: "correct-horse-battery",
      name: "Logout User",
      teamName: "Acme",
    });
    await agent.post("/api/auth/logout").expect(204);
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });
});
