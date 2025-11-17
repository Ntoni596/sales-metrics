import { useState } from "react";
import { bootstrapSetAdmin } from "../services/admin";
import { RequireAuth } from "./RequireAuth";

export function BootstrapAdmin() {
  const [secret, setSecret] = useState("");
  const [uid, setUid] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const res = await bootstrapSetAdmin(
        secret.trim(),
        uid.trim() || undefined
      );
      if ((res as any).ok) setStatus("Success: Admin claim set.");
      else setStatus("Unexpected response; check logs.");
    } catch (err: any) {
      setStatus(err?.message || "Failed to bootstrap admin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <div className="panel">
        <h3>Bootstrap Admin</h3>
        <p>
          One-time action: provide the bootstrap secret to grant admin to the
          current user (or a specific UID).
        </p>
        <form
          onSubmit={onSubmit}
          style={{ display: "grid", gap: 12, maxWidth: 480 }}
        >
          <label>
            Secret
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              placeholder="Enter bootstrap secret"
            />
          </label>
          <label>
            Target UID (optional)
            <input
              type="text"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="Leave blank to make yourself admin"
            />
          </label>
          <button type="submit" disabled={loading || !secret.trim()}>
            {loading ? "Setting…" : "Set Admin"}
          </button>
        </form>
        {status && <p style={{ marginTop: 12 }}>{status}</p>}
      </div>
    </RequireAuth>
  );
}
