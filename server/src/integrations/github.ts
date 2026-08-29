import type { Pin } from "../types.js";

export interface GithubConfig {
  token: string; // a personal access token or fine-grained token with `issues:write` on the repo
  repo: string; // "owner/name"
}

export async function createGithubIssue(
  config: GithubConfig,
  pin: Pin,
  dashboardUrl: string,
): Promise<string> {
  const body = issueBody(pin, dashboardUrl);
  const response = await fetch(`https://api.github.com/repos/${config.repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: issueTitle(pin),
      body,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub issue creation failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { html_url: string };
  return data.html_url;
}

function issueTitle(pin: Pin): string {
  const firstLine = pin.comment.split("\n")[0] ?? pin.comment;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function issueBody(pin: Pin, dashboardUrl: string): string {
  return [
    pin.comment,
    "",
    "---",
    `**Page:** ${pin.page_url}`,
    pin.selector ? `**Element:** \`${pin.selector}\`` : null,
    `**Viewport:** ${pin.viewport_width}x${pin.viewport_height}`,
    pin.user_agent ? `**Browser:** ${pin.user_agent}` : null,
    pin.reporter_name || pin.reporter_email
      ? `**Reported by:** ${[pin.reporter_name, pin.reporter_email].filter(Boolean).join(" - ")}`
      : null,
    `**Filed from Pageflag:** ${dashboardUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
