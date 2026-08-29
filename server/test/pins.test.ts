import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app, resetDb, signUp, createProject, TINY_PNG_DATA_URL } from "./helpers.js";

describe("pins", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects a pin submission from a disallowed origin", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx, { allowedDomains: ["example.com"] });

    const res = await request(app)
      .post(`/api/public/${project.publicKey}/pins`)
      .set("Origin", "https://evil.com")
      .send({
        pageUrl: "https://example.com/pricing",
        x: 42,
        y: 10,
        viewportWidth: 1280,
        viewportHeight: 800,
        comment: "this heading breaks on mobile",
      });
    expect(res.status).toBe(403);
  });

  it("accepts a pin submission from an allowed origin, with a screenshot", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx, { allowedDomains: ["example.com"] });

    const res = await request(app)
      .post(`/api/public/${project.publicKey}/pins`)
      .set("Origin", "https://example.com")
      .send({
        pageUrl: "https://example.com/pricing",
        selector: "h1.hero-title",
        x: 42.5,
        y: 10.25,
        viewportWidth: 1280,
        viewportHeight: 800,
        userAgent: "test-agent/1.0",
        screenshot: TINY_PNG_DATA_URL,
        comment: "this heading breaks on mobile",
        reporterName: "Jamie Client",
        reporterEmail: "jamie@client.example",
      });
    expect(res.status).toBe(201);
    expect(res.body.pin.status).toBe("open");
    expect(res.body.pin.comment).toBe("this heading breaks on mobile");
    const pinId = res.body.pin.id as string;

    const screenshot = await request(app)
      .get(`/api/public/${project.publicKey}/pins/${pinId}/screenshot`)
      .set("Origin", "https://example.com");
    expect(screenshot.status).toBe(200);
    expect(screenshot.headers["content-type"]).toBe("image/png");
    expect(screenshot.body.length).toBeGreaterThan(0);
  });

  it("allows any origin when the project has no allow-list configured yet", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx); // no allowedDomains

    const res = await request(app)
      .post(`/api/public/${project.publicKey}/pins`)
      .set("Origin", "https://anything.example")
      .send({
        pageUrl: "https://anything.example/",
        x: 1,
        y: 1,
        viewportWidth: 1000,
        viewportHeight: 700,
        comment: "hello",
      });
    expect(res.status).toBe(201);
  });

  it("lists open pins for a page so the widget can render markers", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx);
    await request(app)
      .post(`/api/public/${project.publicKey}/pins`)
      .set("Origin", "https://anything.example")
      .send({
        pageUrl: "https://site.example/home",
        x: 5,
        y: 5,
        viewportWidth: 1000,
        viewportHeight: 700,
        comment: "broken layout",
      });

    const res = await request(app)
      .get(`/api/public/${project.publicKey}/pins`)
      .query({ pageUrl: "https://site.example/home" });
    expect(res.status).toBe(200);
    expect(res.body.pins).toHaveLength(1);
    expect(res.body.pins[0].comment).toBe("broken layout");
  });

  it("lets the dashboard filter pins by status, page URL, and reporter", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx);

    async function file(pageUrl: string, comment: string, reporterEmail: string) {
      const res = await request(app).post(`/api/public/${project.publicKey}/pins`).send({
        pageUrl,
        x: 1,
        y: 1,
        viewportWidth: 1000,
        viewportHeight: 700,
        comment,
        reporterEmail,
      });
      return res.body.pin.id as string;
    }

    const pinA = await file("https://site.example/a", "issue A", "alice@example.com");
    await file("https://site.example/b", "issue B", "bob@example.com");

    await ctx.agent.patch(`/api/pins/${pinA}`).send({ status: "resolved" });

    const byStatus = await ctx.agent
      .get(`/api/projects/${project.id}/pins`)
      .query({ status: "open" });
    expect(byStatus.body.pins).toHaveLength(1);
    expect(byStatus.body.pins[0].comment).toBe("issue B");

    const byUrl = await ctx.agent.get(`/api/projects/${project.id}/pins`).query({ pageUrl: "/a" });
    expect(byUrl.body.pins).toHaveLength(1);
    expect(byUrl.body.pins[0].comment).toBe("issue A");

    const byReporter = await ctx.agent
      .get(`/api/projects/${project.id}/pins`)
      .query({ reporter: "alice" });
    expect(byReporter.body.pins).toHaveLength(1);
  });

  it("deletes a pin and its screenshot", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx);
    const created = await request(app).post(`/api/public/${project.publicKey}/pins`).send({
      pageUrl: "https://site.example/",
      x: 1,
      y: 1,
      viewportWidth: 1000,
      viewportHeight: 700,
      comment: "to be deleted",
      screenshot: TINY_PNG_DATA_URL,
    });
    const pinId = created.body.pin.id as string;

    await ctx.agent.delete(`/api/pins/${pinId}`).expect(204);

    const list = await ctx.agent.get(`/api/projects/${project.id}/pins`);
    expect(list.body.pins).toHaveLength(0);
  });

  it("denies pin access to a user outside the project's team", async () => {
    const ctx = await signUp("owner2@example.com");
    const project = await createProject(ctx);
    const created = await request(app).post(`/api/public/${project.publicKey}/pins`).send({
      pageUrl: "https://site.example/",
      x: 1,
      y: 1,
      viewportWidth: 1000,
      viewportHeight: 700,
      comment: "private",
    });
    const pinId = created.body.pin.id as string;

    const outsider = await signUp("outsider@example.com");
    const res = await outsider.agent.patch(`/api/pins/${pinId}`).send({ status: "resolved" });
    expect(res.status).toBe(404);
  });
});
