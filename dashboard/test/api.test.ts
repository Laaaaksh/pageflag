import { describe, it, expect, afterEach, vi } from "vitest";
import { api, ApiError, API_BASE } from "../src/api";

function mockFetch(response: { status: number; body?: unknown }) {
  return vi.fn().mockResolvedValue({
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    json: async () => response.body ?? {},
  });
}

describe("api client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolves with the parsed body on success", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 200, body: { user: { id: "1" } } }));
    const res = await api.me();
    expect(res).toEqual({ user: { id: "1" } });
  });

  it("resolves undefined for a 204 without trying to parse a body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 204,
      ok: true,
      json: async () => {
        throw new Error("should not be called for a 204");
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.logout()).resolves.toBeUndefined();
  });

  it("throws an ApiError carrying the server's message and status", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 409, body: { error: "already exists" } }));
    await expect(
      api.signup({ email: "a@b.com", password: "x", name: "n", teamName: "t" }),
    ).rejects.toMatchObject({ status: 409, message: "already exists" });
  });

  it("falls back to a generic message when the error body has no `error` field", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 500, body: {} }));
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    await expect(api.me()).rejects.toMatchObject({ message: "request failed (500)" });
  });

  it("always sends credentials so the session cookie travels cross-origin", async () => {
    const fetchMock = mockFetch({ status: 200, body: { user: {}, teams: [] } });
    vi.stubGlobal("fetch", fetchMock);
    await api.me();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE}/api/auth/me`);
    expect(init.credentials).toBe("include");
  });

  it("omits credentials on the public review-link call, which allows any origin without allowing credentials", async () => {
    // A browser rejects a cross-origin response outright when the request was sent
    // with credentials: "include" but the response's Access-Control-Allow-Origin is
    // "*" (as ours is here, since this endpoint takes no session) - regressing this
    // makes every review link silently fail with a generic network error.
    const fetchMock = mockFetch({ status: 200, body: { project: { name: "p" }, pins: [] } });
    vi.stubGlobal("fetch", fetchMock);
    await api.review("some-token");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE}/api/review/some-token`);
    expect(init.credentials).toBe("omit");
  });

  it("builds the pin list query string only from the filters actually provided", async () => {
    const fetchMock = mockFetch({ status: 200, body: { pins: [] } });
    vi.stubGlobal("fetch", fetchMock);
    await api.listPins("proj-1", { status: "open" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${API_BASE}/api/projects/proj-1/pins?status=open`);
  });
});
