import type { Integration, Pin, PinStatus, Project, Team, User } from "./types";

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    // Session-cookie routes need "include"; the public review-link routes don't take a
    // session at all, and their CORS response allows any origin without allowing
    // credentials - pairing that with "include" makes the browser reject the response
    // outright, so callers with no cookies to send must opt out explicitly.
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (body as { error?: string }).error ?? `request failed (${res.status})`,
    );
  }
  return body as T;
}

export const api = {
  signup: (input: { email: string; password: string; name: string; teamName: string }) =>
    request<{ user: User; team: Team }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (input: { email: string; password: string }) =>
    request<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(input) }),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  me: () => request<{ user: User; teams: Team[] }>("/api/auth/me"),

  listProjects: () => request<{ projects: Project[] }>("/api/projects"),

  createProject: (input: { name: string; teamId: string; allowedDomains: string[] }) =>
    request<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify(input) }),

  getProject: (id: string) => request<{ project: Project }>(`/api/projects/${id}`),

  updateProject: (id: string, input: { name?: string; allowedDomains?: string[] }) =>
    request<{ project: Project }>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),

  regenerateReviewToken: (id: string) =>
    request<{ project: Project }>(`/api/projects/${id}/regenerate-review-token`, {
      method: "POST",
    }),

  listPins: (
    projectId: string,
    query: { status?: PinStatus; pageUrl?: string; reporter?: string },
  ) => {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.pageUrl) params.set("pageUrl", query.pageUrl);
    if (query.reporter) params.set("reporter", query.reporter);
    const qs = params.toString();
    return request<{ pins: Pin[] }>(`/api/projects/${projectId}/pins${qs ? `?${qs}` : ""}`);
  },

  updatePinStatus: (pinId: string, status: PinStatus) =>
    request<{ pin: Pin }>(`/api/pins/${pinId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  deletePin: (pinId: string) => request<void>(`/api/pins/${pinId}`, { method: "DELETE" }),

  createIssue: (pinId: string, provider: "github" | "linear") =>
    request<{ pin: Pin }>(`/api/pins/${pinId}/create-issue`, {
      method: "POST",
      body: JSON.stringify({ provider }),
    }),

  screenshotUrl: (pinId: string) => `${API_BASE}/api/pins/${pinId}/screenshot`,

  listIntegrations: (projectId: string) =>
    request<{ integrations: Integration[] }>(`/api/projects/${projectId}/integrations`),

  setGithubIntegration: (projectId: string, input: { token: string; repo: string }) =>
    request<void>(`/api/projects/${projectId}/integrations/github`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  setLinearIntegration: (projectId: string, input: { apiKey: string; teamId: string }) =>
    request<void>(`/api/projects/${projectId}/integrations/linear`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  removeIntegration: (projectId: string, provider: "github" | "linear") =>
    request<void>(`/api/projects/${projectId}/integrations/${provider}`, { method: "DELETE" }),

  review: (token: string) =>
    request<{ project: { name: string }; pins: Pin[] }>(`/api/review/${token}`, {
      credentials: "omit",
    }),

  reviewScreenshotUrl: (token: string, pinId: string) =>
    `${API_BASE}/api/review/${token}/pins/${pinId}/screenshot`,
};
