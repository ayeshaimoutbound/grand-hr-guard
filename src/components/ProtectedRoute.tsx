import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireSuperAdmin?: boolean;
}

// Routes that "office" role users are allowed to access
const OFFICE_ALLOWED = ["/employees", "/attendance"];

export function ProtectedRoute({ children, requireSuperAdmin = false }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  if (role === "office" && !OFFICE_ALLOWED.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/employees" replace />;
  }

  return <>{children}</>;
}
