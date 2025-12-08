import { useEffect, useState } from "react";
import {
  listUsers,
  createUser,
  setUserAdmin,
  setUserDisabled,
  deleteUser,
  type ManagedUser,
} from "../services/admin";
import { useAuth } from "../auth";

export function AdminUsers() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const u = await listUsers();
      setUsers(u);
      setLoading(false);
    })();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    const res = await createUser(email, name);
    alert(
      res.resetLink
        ? `User created. Share this reset link to set password: ${res.resetLink}`
        : `User created.`
    );
    const u = await listUsers();
    setUsers(u);
    setEmail("");
    setName("");
  }

  async function toggleAdmin(u: ManagedUser) {
    await setUserAdmin(u.uid, !u.admin);
    const us = await listUsers();
    setUsers(us);
  }
  async function toggleDisabled(u: ManagedUser) {
    await setUserDisabled(u.uid, !u.disabled);
    const us = await listUsers();
    setUsers(us);
  }
  async function removeUser(u: ManagedUser) {
    if (!confirm(`Delete user ${u.email}?`)) return;
    await deleteUser(u.uid);
    const us = await listUsers();
    setUsers(us);
  }

  if (!isAdmin) return <div className="panel">Not authorized.</div>;
  if (loading) return <div className="panel">Loading users…</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Add User</h3>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              flex: 1,
              padding: 8,
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "#101316",
              color: "var(--text)",
            }}
          />
          <input
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              flex: 1,
              padding: 8,
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "#101316",
              color: "var(--text)",
            }}
          />
          <button type="submit">Create</button>
        </form>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Users</h3>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 6 }}>Email</th>
              <th style={{ textAlign: "left", padding: 6 }}>Name</th>
              <th style={{ textAlign: "left", padding: 6 }}>Admin</th>
              <th style={{ textAlign: "left", padding: 6 }}>Disabled</th>
              <th style={{ textAlign: "left", padding: 6 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid}>
                <td style={{ padding: 6 }}>{u.email}</td>
                <td style={{ padding: 6 }}>{u.displayName}</td>
                <td style={{ padding: 6 }}>{u.admin ? "Yes" : "No"}</td>
                <td style={{ padding: 6 }}>{u.disabled ? "Yes" : "No"}</td>
                <td style={{ padding: 6, display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => toggleAdmin(u)}>
                    {u.admin ? "Revoke Admin" : "Make Admin"}
                  </button>
                  <button type="button" onClick={() => toggleDisabled(u)}>
                    {u.disabled ? "Enable" : "Disable"}
                  </button>
                  <button type="button" onClick={() => removeUser(u)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
