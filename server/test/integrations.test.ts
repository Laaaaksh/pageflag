import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app, resetDb, signUp, createProject } from "./helpers.js";

async function filePin(publicKey: string, comment = "a real bug") {
  const res = await request(app).post(`/api/public/${publicKey}/pins`).send({
    pageUrl: "https://site.example/",
    x: 1,
    y: 1,
    viewportWidth: 1000,
    viewportHeight: 700,
    comment,
  });
  return res.body.pin.id as string;
}

describe("issue-tracker integrations", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses create-issue when no integration is configured", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx);
    const pinId = await filePin(project.publicKey);

    const res = await ctx.agent
      .post(`/api/pins/${pinId}/create-issue`)
      .send({ provider: "github" });
    expect(res.status).toBe(400);
  });

  it("creates a GitHub issue from a pin and records the URL", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx);
    const pinId = await filePin(project.publicKey, "the button is misaligned");

    await ctx.agent
      .put(`/api/projects/${project.id}/integrations/github`)
      .send({ token: "ghp_test", repo: "acme/site" })
      .expect(204);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: "https://github.com/acme/site/issues/42" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await ctx.agent
      .post(`/api/pins/${pinId}/create-issue`)
      .send({ provider: "github" });
    expect(res.status).toBe(200);
    expect(res.body.pin.external_issue_url).toBe("https://github.com/acme/site/issues/42");
    expect(res.body.pin.external_issue_provider).toBe("github");

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/acme/site/issues");
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer ghp_test");
    const body = JSON.parse(opts.body as string) as { title: string; body: string };
    expect(body.title).toBe("the button is misaligned");
    expect(body.body).toContain("https://site.example/");
  });

  it("refuses a second create-issue once a pin already has one", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx);
    const pinId = await filePin(project.publicKey);

    await ctx.agent
      .put(`/api/projects/${project.id}/integrations/github`)
      .send({ token: "ghp_test", repo: "acme/site" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ html_url: "https://github.com/acme/site/issues/1" }),
      }),
    );

    await ctx.agent
      .post(`/api/pins/${pinId}/create-issue`)
      .send({ provider: "github" })
      .expect(200);
    const second = await ctx.agent
      .post(`/api/pins/${pinId}/create-issue`)
      .send({ provider: "github" });
    expect(second.status).toBe(409);
  });

  it("creates a Linear issue via the GraphQL API", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx);
    const pinId = await filePin(project.publicKey, "linear-bound bug");

    await ctx.agent
      .put(`/api/projects/${project.id}/integrations/linear`)
      .send({ apiKey: "lin_test", teamId: "team-uuid" })
      .expect(204);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            issueCreate: { success: true, issue: { url: "https://linear.app/acme/issue/ACM-1" } },
          },
        }),
      }),
    );

    const res = await ctx.agent
      .post(`/api/pins/${pinId}/create-issue`)
      .send({ provider: "linear" });
    expect(res.status).toBe(200);
    expect(res.body.pin.external_issue_url).toBe("https://linear.app/acme/issue/ACM-1");
  });

  it("surfaces a provider failure as a 502 without touching the pin", async () => {
    const ctx = await signUp();
    const project = await createProject(ctx);
    const pinId = await filePin(project.publicKey);

    await ctx.agent
      .put(`/api/projects/${project.id}/integrations/github`)
      .send({ token: "ghp_bad", repo: "acme/site" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "Bad credentials" }),
    );

    const res = await ctx.agent
      .post(`/api/pins/${pinId}/create-issue`)
      .send({ provider: "github" });
    expect(res.status).toBe(502);
  });
});
