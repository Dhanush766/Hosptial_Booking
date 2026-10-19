import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const destination = location.state?.from?.pathname || "/";
  if (user) return <Navigate to={destination} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.status === 429 ? "Too many attempts. Please wait a minute and try again." : err.message);
      setBusy(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-4">
          <div className="card">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <i className="bi bi-hospital text-primary display-4" />
                <h1 className="h4 mt-2">Hospital Appointment Booking System</h1>
                <p className="text-muted mb-0">Please sign in to continue</p>
              </div>

              {error && (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">
                    Username
                  </label>
                  <input
                    id="username"
                    className="form-control"
                    autoComplete="username"
                    required
                    autoFocus
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="form-control"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                  {busy ? "Signing in..." : "Login"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
