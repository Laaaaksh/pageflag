import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, API_BASE } from "../api";
import type { Integration, Pin, PinStatus, Project } from "../types";

type Tab = "pins" | "install" | "integrations" | "settings";

export default function ProjectDetailPage() {
  const { projectId, pinId } = useParams<{ projectId: string; pinId?: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>("pins");

  useEffect(() => {
    if (!projectId) return;
    void api.getProject(projectId).then(
      (res) => setProject(res.project),
      () => navigate("/"),
    );
  }, [projectId, navigate]);

  if (!project) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page">
      <h1>{project.name}</h1>
      <nav className="tabs">
        {(["pins", "install", "integrations", "settings"] as const).map((t) => (
          <button
            key={t}
            className={t === tab ? "tab tab-active" : "tab"}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === "pins" && <PinsTab project={project} focusPinId={pinId} />}
      {tab === "install" && <InstallTab project={project} />}
      {tab === "integrations" && <IntegrationsTab project={project} />}
      {tab === "settings" && <SettingsTab project={project} onChange={setProject} />}
    </div>
  );
}

function PinsTab({ project, focusPinId }: { project: Project; focusPinId?: string }) {
  const [pins, setPins] = useState<Pin[] | null>(null);
  const [status, setStatus] = useState<PinStatus | "">("");
  const [pageUrl, setPageUrl] = useState("");
  const [reporter, setReporter] = useState("");
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  const load = useCallback(() => {
    void api
      .listPins(project.id, {
        status: status || undefined,
        pageUrl: pageUrl || undefined,
        reporter: reporter || undefined,
      })
      .then((res) => setPins(res.pins));
  }, [project.id, status, pageUrl, reporter]);

  useEffect(() => load(), [load]);
  useEffect(() => {
    void api.listIntegrations(project.id).then((res) => setIntegrations(res.integrations));
  }, [project.id]);

  async function setPinStatus(pin: Pin, next: PinStatus) {
    const res = await api.updatePinStatus(pin.id, next);
    setPins((prev) => prev?.map((p) => (p.id === pin.id ? res.pin : p)) ?? null);
  }

  async function removePin(pin: Pin) {
    if (!confirm("Delete this pin? This cannot be undone.")) return;
    await api.deletePin(pin.id);
    setPins((prev) => prev?.filter((p) => p.id !== pin.id) ?? null);
  }

  async function fileIssue(pin: Pin, provider: "github" | "linear") {
    try {
      const res = await api.createIssue(pin.id, provider);
      setPins((prev) => prev?.map((p) => (p.id === pin.id ? res.pin : p)) ?? null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not create the issue.");
    }
  }

  const hasGithub = integrations.some((i) => i.provider === "github");
  const hasLinear = integrations.some((i) => i.provider === "linear");

  return (
    <div>
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value as PinStatus | "")}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <input
          placeholder="Filter by page URL"
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
        />
        <input
          placeholder="Filter by reporter"
          value={reporter}
          onChange={(e) => setReporter(e.target.value)}
        />
      </div>

      {pins === null && <p>Loading...</p>}
      {pins?.length === 0 && (
        <p className="empty-hint">
          No pins yet. Install the snippet (see the Install tab) and click something on your site.
        </p>
      )}
      <ul className="pin-list">
        {pins?.map((pin) => (
          <li
            key={pin.id}
            id={`pin-${pin.id}`}
            className={pin.id === focusPinId ? "card pin-card pin-card-focused" : "card pin-card"}
            ref={(el) => {
              if (el && pin.id === focusPinId) el.scrollIntoView?.({ block: "center" });
            }}
          >
            {pin.screenshot_path && (
              <a
                className="pin-screenshot-link"
                href={api.screenshotUrl(pin.id)}
                target="_blank"
                rel="noreferrer"
                title="Open full screenshot"
              >
                <img
                  className="pin-screenshot"
                  src={api.screenshotUrl(pin.id)}
                  alt={`Screenshot for pin: ${pin.comment}`}
                />
              </a>
            )}
            <div className="pin-body">
              <p className="pin-comment">{pin.comment}</p>
              <p className="pin-meta">
                <a href={pin.page_url} target="_blank" rel="noreferrer">
                  {pin.page_url}
                </a>
                {" · "}
                {new Date(pin.created_at).toLocaleString()}
                {pin.reporter_name || pin.reporter_email
                  ? ` · ${[pin.reporter_name, pin.reporter_email].filter(Boolean).join(" - ")}`
                  : ""}
              </p>
              <div className="pin-actions">
                <select
                  value={pin.status}
                  onChange={(e) => void setPinStatus(pin, e.target.value as PinStatus)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                {pin.external_issue_url ? (
                  <a
                    href={pin.external_issue_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-link"
                  >
                    View {pin.external_issue_provider} issue
                  </a>
                ) : (
                  <>
                    {hasGithub && (
                      <button
                        className="btn-secondary"
                        onClick={() => void fileIssue(pin, "github")}
                      >
                        Create GitHub issue
                      </button>
                    )}
                    {hasLinear && (
                      <button
                        className="btn-secondary"
                        onClick={() => void fileIssue(pin, "linear")}
                      >
                        Create Linear issue
                      </button>
                    )}
                  </>
                )}
                <button className="btn-danger" onClick={() => void removePin(pin)}>
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InstallTab({ project }: { project: Project }) {
  const snippet = `<script src="${API_BASE}/widget.js" data-project="${project.public_key}"></script>`;
  const [copied, setCopied] = useState(false);

  return (
    <div className="card">
      <h2>Install the snippet</h2>
      <p>
        Paste this immediately before the closing <code>&lt;/body&gt;</code> tag of every page you
        want feedback on:
      </p>
      <pre className="snippet">{snippet}</pre>
      <button
        className="btn-secondary"
        onClick={() => {
          void navigator.clipboard.writeText(snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied!" : "Copy snippet"}
      </button>
      <p className="hint">
        A floating feedback button appears on the page. Anyone can click it, click something on the
        page, and leave a comment - no account required. Set a domain allow-list under Settings
        before sharing this snippet publicly, so a leaked copy can't be used to capture screenshots
        of an unrelated site.
      </p>
    </div>
  );
}

function IntegrationsTab({ project }: { project: Project }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [githubToken, setGithubToken] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [linearKey, setLinearKey] = useState("");
  const [linearTeamId, setLinearTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void api.listIntegrations(project.id).then((res) => setIntegrations(res.integrations));
  }, [project.id]);

  useEffect(() => load(), [load]);

  async function saveGithub() {
    setError(null);
    try {
      await api.setGithubIntegration(project.id, { token: githubToken, repo: githubRepo });
      setGithubToken("");
      setGithubRepo("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the GitHub integration.");
    }
  }

  async function saveLinear() {
    setError(null);
    try {
      await api.setLinearIntegration(project.id, { apiKey: linearKey, teamId: linearTeamId });
      setLinearKey("");
      setLinearTeamId("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the Linear integration.");
    }
  }

  async function remove(provider: "github" | "linear") {
    await api.removeIntegration(project.id, provider);
    load();
  }

  const github = integrations.find((i) => i.provider === "github");
  const linear = integrations.find((i) => i.provider === "linear");

  return (
    <div className="integrations-grid">
      {error && <p className="form-error">{error}</p>}
      <div className="card">
        <h2>GitHub Issues</h2>
        {github ? (
          <>
            <p className="hint">Connected. New pins can be filed straight to a GitHub repo.</p>
            <button className="btn-danger" onClick={() => void remove("github")}>
              Disconnect
            </button>
          </>
        ) : (
          <>
            <label>
              Personal access token (needs <code>issues:write</code> on the repo)
              <input value={githubToken} onChange={(e) => setGithubToken(e.target.value)} />
            </label>
            <label>
              Repository (owner/name)
              <input
                placeholder="acme/marketing-site"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
              />
            </label>
            <button
              className="btn-primary"
              onClick={() => void saveGithub()}
              disabled={!githubToken || !githubRepo}
            >
              Connect
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h2>Linear</h2>
        {linear ? (
          <>
            <p className="hint">Connected. New pins can be filed straight to a Linear team.</p>
            <button className="btn-danger" onClick={() => void remove("linear")}>
              Disconnect
            </button>
          </>
        ) : (
          <>
            <label>
              API key
              <input value={linearKey} onChange={(e) => setLinearKey(e.target.value)} />
            </label>
            <label>
              Team ID
              <input value={linearTeamId} onChange={(e) => setLinearTeamId(e.target.value)} />
            </label>
            <button
              className="btn-primary"
              onClick={() => void saveLinear()}
              disabled={!linearKey || !linearTeamId}
            >
              Connect
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(project.name);
  const [domains, setDomains] = useState(project.allowed_domains.join(", "));
  const [saved, setSaved] = useState(false);
  const reviewUrl = `${window.location.origin}/review/${project.review_token}`;

  async function save() {
    const allowedDomains = domains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    const res = await api.updateProject(project.id, { name, allowedDomains });
    onChange(res.project);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function regenerateReviewLink() {
    if (!confirm("Regenerating the review link invalidates the old one. Continue?")) return;
    const res = await api.regenerateReviewToken(project.id);
    onChange(res.project);
  }

  async function deleteProject() {
    if (!confirm(`Delete "${project.name}" and all its pins? This cannot be undone.`)) return;
    await api.deleteProject(project.id);
    navigate("/");
  }

  return (
    <div>
      <div className="card">
        <h2>General</h2>
        <label>
          Site name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Allowed domains (comma-separated; leave empty to allow any origin while you're setting up)
          <input
            placeholder="example.com, *.staging.example.com"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
          />
        </label>
        <button className="btn-primary" onClick={() => void save()}>
          {saved ? "Saved!" : "Save"}
        </button>
      </div>

      <div className="card">
        <h2>Public review link</h2>
        <p>Share this unlisted link so a client can review feedback without a Pageflag account:</p>
        <pre className="snippet">{reviewUrl}</pre>
        <button
          className="btn-secondary"
          onClick={() => void navigator.clipboard.writeText(reviewUrl)}
        >
          Copy link
        </button>
        <button className="btn-danger" onClick={() => void regenerateReviewLink()}>
          Regenerate link
        </button>
      </div>

      <div className="card danger-zone">
        <h2>Danger zone</h2>
        <button className="btn-danger" onClick={() => void deleteProject()}>
          Delete this site
        </button>
      </div>
    </div>
  );
}
