-- Core schema: users, teams, projects, pins, integrations.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teams (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role    TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE projects (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id          UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    public_key       TEXT NOT NULL UNIQUE,
    review_token     TEXT NOT NULL UNIQUE,
    allowed_domains  TEXT[] NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_team_id ON projects(team_id);

CREATE TABLE pins (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    page_url                TEXT NOT NULL,
    selector                TEXT,
    x                       NUMERIC NOT NULL,
    y                       NUMERIC NOT NULL,
    viewport_width          INTEGER NOT NULL,
    viewport_height         INTEGER NOT NULL,
    user_agent              TEXT,
    screenshot_path         TEXT,
    comment                 TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    reporter_name            TEXT,
    reporter_email           TEXT,
    external_issue_url       TEXT,
    external_issue_provider  TEXT CHECK (external_issue_provider IN ('github', 'linear')),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pins_project_id ON pins(project_id);
CREATE INDEX idx_pins_status ON pins(project_id, status);
CREATE INDEX idx_pins_page_url ON pins(project_id, page_url);

CREATE TABLE integrations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL CHECK (provider IN ('github', 'linear')),
    config      JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, provider)
);
