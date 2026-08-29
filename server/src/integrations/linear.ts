import type { Pin } from "../types.js";

export interface LinearConfig {
  apiKey: string;
  teamId: string; // Linear team UUID that new issues are created under
}

const LINEAR_API = "https://api.linear.app/graphql";

export async function createLinearIssue(
  config: LinearConfig,
  pin: Pin,
  dashboardUrl: string,
): Promise<string> {
  const response = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      Authorization: config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue { url }
          }
        }
      `,
      variables: {
        input: {
          teamId: config.teamId,
          title: issueTitle(pin),
          description: issueDescription(pin, dashboardUrl),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Linear issue creation failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data?: { issueCreate?: { success: boolean; issue?: { url: string } } };
    errors?: Array<{ message: string }>;
  };

  if (data.errors?.length) {
    throw new Error(`Linear issue creation failed: ${data.errors[0]?.message}`);
  }
  const issue = data.data?.issueCreate;
  if (!issue?.success || !issue.issue) {
    throw new Error("Linear issue creation failed: no issue returned");
  }
  return issue.issue.url;
}

function issueTitle(pin: Pin): string {
  const firstLine = pin.comment.split("\n")[0] ?? pin.comment;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function issueDescription(pin: Pin, dashboardUrl: string): string {
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
