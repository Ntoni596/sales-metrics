import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useState } from "react";
import type { FormEvent } from "react";

export function Login() {
  const { signIn, resetPassword, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from?.pathname || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (e) {
      console.error("Login failed", e);
      alert("Login failed. Check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email) return alert("Enter your email first.");
    try {
      await resetPassword(email);
      alert("Password reset email sent.");
    } catch (e) {
      console.error("Reset failed", e);
      alert("Failed to send reset email.");
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", height: "80vh" }}>
      <form className="panel" style={{ width: 360 }} onSubmit={handleLogin}>
        <h3 style={{ marginTop: 0 }}>Sign in</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: 8,
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "#101316",
              color: "var(--text)",
            }}
          />
          <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: 8,
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "#101316",
              color: "var(--text)",
            }}
          />
          <div className="flex-between" style={{ marginTop: 8 }}>
            <button type="submit" disabled={loading || busy}>
              Sign in
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading || busy}
            >
              Forgot password
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
