import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import type { ReactNode } from "react";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading)
    return <div style={{ padding: 24 }}>Checking authentication…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!isAdmin) return <div style={{ padding: 24 }}>Not authorized.</div>;
  return <>{children}</>;
}
