import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import type { Pin } from "../types";

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.review(token).then(
      (res) => {
        setProjectName(res.project.name);
        setPins(res.pins);
      },
      (err) => setError(err instanceof ApiError ? err.message : "This review link is invalid."),
    );
  }, [token]);

  if (error) {
    return (
      <div className="review-page">
        <div className="card">
          <p className="form-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="review-page">
      <header className="review-header">
        <img src="/pageflag-mark.svg" alt="" width={22} height={22} />
        <h1>{projectName ?? "Loading..."}</h1>
      </header>
      <p className="hint">
        Read-only feedback review. Ask the site owner for dashboard access to reply.
      </p>
      {pins === null && !error && <p>Loading...</p>}
      {pins?.length === 0 && <p className="empty-hint">No feedback has been left yet.</p>}
      <ul className="pin-list">
        {pins?.map((pin) => (
          <li key={pin.id} className="card pin-card">
            {pin.screenshot_path && token && (
              <img
                className="pin-screenshot"
                src={api.reviewScreenshotUrl(token, pin.id)}
                alt={`Screenshot for pin: ${pin.comment}`}
              />
            )}
            <div className="pin-body">
              <p className="pin-comment">{pin.comment}</p>
              <p className="pin-meta">
                {pin.page_url} · {new Date(pin.created_at).toLocaleString()} ·{" "}
                <span className={`status-badge status-${pin.status}`}>
                  {pin.status.replace("_", " ")}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
