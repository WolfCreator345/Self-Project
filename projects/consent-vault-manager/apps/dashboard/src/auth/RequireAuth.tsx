import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { username, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p style={{ fontFamily: "sans-serif", padding: 24 }}>Loading…</p>;
  if (!username) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return <>{children}</>;
}
