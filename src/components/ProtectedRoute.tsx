import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireSuperAdmin?: boolean;
}

// Routes "office" role can access (Salaries removed; Inventory added)
const OFFICE_ALLOWED = ["/employees", "/attendance", "/inventory", "/food"];
// Routes admin+ can access (blocked for office)
const ADMIN_ONLY = ["/accounts", "/invoices", "/companies", "/salaries", "/dashboard"];
// Super-admin only
const SUPER_ADMIN_ONLY = ["/settings"];

// Map path prefix -> module key for per-user override checks
const PATH_TO_MODULE: { prefix: string; key: string }[] = [
  { prefix: "/dashboard", key: "dashboard" },
  { prefix: "/employees", key: "employees" },
  { prefix: "/companies", key: "companies" },
  { prefix: "/attendance", key: "attendance" },
  { prefix: "/salaries", key: "salaries" },
  { prefix: "/invoices", key: "invoices" },
  { prefix: "/accounts", key: "accounts" },
  { prefix: "/inventory", key: "inventory" },
  { prefix: "/settings", key: "settings" },
];

export function ProtectedRoute({ children, requireSuperAdmin = false }: ProtectedRouteProps) {
  const { user, role, loading, moduleAccess } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requireSuperAdmin && role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const landing = role === "office" ? "/employees" : "/dashboard";

  // Super-admin-only routes
  if (SUPER_ADMIN_ONLY.some((p) => location.pathname.startsWith(p)) && role !== "super_admin") {
    return <Navigate to={landing} replace />;
  }

  // Office role restrictions
  if (role === "office" && !OFFICE_ALLOWED.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/employees" replace />;
  }

  // Admin-only routes (block office)
  if (role !== "admin" && role !== "super_admin" &&
      ADMIN_ONLY.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to={landing} replace />;
  }

  // Per-user module override
  const match = PATH_TO_MODULE.find((m) => location.pathname.startsWith(m.prefix));
  if (match && moduleAccess && moduleAccess[match.key] === false) {
    return <Navigate to={landing} replace />;
  }

  return <>{children}</>;
}
