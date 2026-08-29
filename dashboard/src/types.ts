export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  public_key: string;
  review_token: string;
  allowed_domains: string[];
  created_at: string;
}

export type PinStatus = "open" | "in_progress" | "resolved";
export type IssueProvider = "github" | "linear";

export interface Pin {
  id: string;
  project_id: string;
  page_url: string;
  selector: string | null;
  x: string;
  y: string;
  viewport_width: number;
  viewport_height: number;
  user_agent: string | null;
  screenshot_path: string | null;
  comment: string;
  status: PinStatus;
  reporter_name: string | null;
  reporter_email: string | null;
  external_issue_url: string | null;
  external_issue_provider: IssueProvider | null;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  project_id: string;
  provider: IssueProvider;
  created_at: string;
}
