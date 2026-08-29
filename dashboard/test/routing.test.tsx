// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

// This route is the target of the dashboard link baked into every GitHub/Linear issue
// filed from a pin (see server/src/routes/pins.ts's dashboardUrl) - if it 404s, "one
// click to see it in Pageflag" silently lands the reporter on their site list instead.
describe("dashboard routing", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) act(() => root!.unmount());
    if (container) container.remove();
    container = null;
    root = null;
    vi.unstubAllGlobals();
  });

  function mockApi() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        const json = (body: unknown, status = 200) => ({
          status,
          ok: status >= 200 && status < 300,
          json: async () => body,
        });

        if (url.endsWith("/api/auth/me")) {
          return json({ user: { id: "u1", email: "a@b.com", name: "Ada" }, teams: [] });
        }
        if (url.endsWith("/api/projects/p1")) {
          return json({
            project: {
              id: "p1",
              team_id: "t1",
              name: "Test project",
              public_key: "pf_test",
              review_token: "tok",
              allowed_domains: [],
              created_at: new Date().toISOString(),
            },
          });
        }
        if (url.includes("/api/projects/p1/pins")) {
          return json({
            pins: [
              {
                id: "pin1",
                project_id: "p1",
                page_url: "https://example.com",
                selector: null,
                x: "0",
                y: "0",
                viewport_width: 1200,
                viewport_height: 800,
                user_agent: null,
                screenshot_path: null,
                comment: "Fix this button",
                status: "open",
                reporter_name: null,
                reporter_email: null,
                external_issue_url: null,
                external_issue_provider: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          });
        }
        if (url.includes("/api/projects/p1/integrations")) {
          return json({ integrations: [] });
        }
        return json({}, 404);
      }),
    );
  }

  it("resolves a pin deep link to the project's pin list instead of redirecting home", async () => {
    mockApi();
    container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      root = createRoot(container!);
      root.render(
        <MemoryRouter initialEntries={["/projects/p1/pins/pin1"]}>
          <App />
        </MemoryRouter>,
      );
    });
    // Flush the chained getProject -> listPins/listIntegrations effects.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector("h1")?.textContent).toBe("Test project");
    expect(container.textContent).toContain("Fix this button");
    expect(container.querySelector("#pin-pin1")).not.toBeNull();
  });
});
