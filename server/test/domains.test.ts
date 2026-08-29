import { describe, it, expect } from "vitest";
import { isOriginAllowed } from "../src/lib/domains.js";

describe("isOriginAllowed", () => {
  it("allows any origin when the allow-list is empty", () => {
    expect(isOriginAllowed("https://anything.example", [])).toBe(true);
    expect(isOriginAllowed(undefined, [])).toBe(true);
  });

  it("rejects a missing Origin header when an allow-list is configured", () => {
    expect(isOriginAllowed(undefined, ["example.com"])).toBe(false);
  });

  it("matches an exact hostname", () => {
    expect(isOriginAllowed("https://example.com", ["example.com"])).toBe(true);
    expect(isOriginAllowed("https://evil.com", ["example.com"])).toBe(false);
  });

  it("does not treat a subdomain as matching a bare hostname", () => {
    expect(isOriginAllowed("https://staging.example.com", ["example.com"])).toBe(false);
  });

  it("matches a wildcard subdomain pattern", () => {
    const allowed = ["*.example.com"];
    expect(isOriginAllowed("https://staging.example.com", allowed)).toBe(true);
    expect(isOriginAllowed("https://example.com", allowed)).toBe(true);
    expect(isOriginAllowed("https://example.com.evil.com", allowed)).toBe(false);
  });

  it("rejects a malformed origin", () => {
    expect(isOriginAllowed("not-a-url", ["example.com"])).toBe(false);
  });
});
