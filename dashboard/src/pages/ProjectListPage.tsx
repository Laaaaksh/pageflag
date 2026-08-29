import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../AuthContext";
import type { Project } from "../types";

export default function ProjectListPage() {
  const { teams } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.listProjects().then((res) => setProjects(res.projects));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!teams[0]) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createProject({ name, teamId: teams[0].id, allowedDomains: [] });
      setProjects((prev) => [res.project, ...(prev ?? [])]);
      setName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>Your sites</h1>
      <form className="card inline-form" onSubmit={(e) => void onCreate(e)}>
        <input
          placeholder="e.g. Marketing site"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating..." : "New site"}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}

      {projects === null && <p>Loading...</p>}
      {projects?.length === 0 && (
        <p className="empty-hint">
          No sites yet. Create one above, then install its snippet on the page you want feedback on.
        </p>
      )}
      <ul className="project-list">
        {projects?.map((project) => (
          <li key={project.id}>
            <Link className="card project-card" to={`/projects/${project.id}`}>
              <span className="project-card-name">{project.name}</span>
              <span className="project-card-domains">
                {project.allowed_domains.length > 0
                  ? project.allowed_domains.join(", ")
                  : "no domain allow-list set yet"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
