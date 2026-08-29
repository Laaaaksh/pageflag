import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app, resetDb, signUp, createProject } from "./helpers.js";

describe("public review link", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns 404 for an unknown token", async () => {
    const res = await request(app).get("/api/review/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("lets an unauthenticated client view a project's pins via its review token", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx, { name: "Client Staging Site" });
    await request(app).post(`/api/public/${project.publicKey}/pins`).send({
      pageUrl: "https://site.example/",
      x: 1,
      y: 1,
      viewportWidth: 1000,
      viewportHeight: 700,
      comment: "visible to the client",
    });

    const res = await request(app).get(`/api/review/${project.reviewToken}`);
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe("Client Staging Site");
    expect(res.body.pins).toHaveLength(1);
    expect(res.body.pins[0].comment).toBe("visible to the client");
  });

  it("rotating the review token invalidates the old link", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx);
    const oldToken = project.reviewToken;

    await ctx.agent.post(`/api/projects/${project.id}/regenerate-review-token`).expect(200);

    const stale = await request(app).get(`/api/review/${oldToken}`);
    expect(stale.status).toBe(404);
  });
});
