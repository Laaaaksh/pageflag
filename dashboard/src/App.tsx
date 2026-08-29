import type { ReactElement } from "react";
import { Navigate, Route, Routes, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProjectListPage from "./pages/ProjectListPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ReviewPage from "./pages/ReviewPage";

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children }: { children: ReactElement }) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/" className="brand">
          <img src="/pageflag-mark.svg" alt="" width={22} height={22} />
          Pageflag
        </Link>
        {user && (
          <div className="shell-header-user">
            <span>{user.name}</span>
            <button className="btn-link" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        )}
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <Shell>
              <LoginPage />
            </Shell>
          }
        />
        <Route
          path="/signup"
          element={
            <Shell>
              <SignupPage />
            </Shell>
          }
        />
        <Route path="/review/:token" element={<ReviewPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Shell>
                <ProjectListPage />
              </Shell>
            </RequireAuth>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <RequireAuth>
              <Shell>
                <ProjectDetailPage />
              </Shell>
            </RequireAuth>
          }
        />
        <Route
          path="/projects/:projectId/pins/:pinId"
          element={
            <RequireAuth>
              <Shell>
                <ProjectDetailPage />
              </Shell>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
