import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../AuthContext";

export default function SignupPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signup({ name, teamName, email, password });
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={(e) => void onSubmit(e)}>
        <h1>Create your account</h1>
        <label>
          Your name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Team name
          <input
            required
            placeholder="Acme Agency"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
        </label>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
