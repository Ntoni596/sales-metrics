import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import type { ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return <div style={{ padding: 24 }}>Checking authentication…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}
