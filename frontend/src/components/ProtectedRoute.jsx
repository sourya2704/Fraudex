/**
 * ProtectedRoute
 *
 * Wraps any route that requires authentication.
 * - While we're checking a saved token (loading=true) shows a full-screen spinner.
 * - If user is not logged in, redirects to /login (saves the attempted URL so we
 *   can send them back after login).
 * - Optionally accepts `allowedRoles` to enforce RBAC at the route level.
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Still checking saved token — show nothing (or a spinner)
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5f0]">
        <div className="flex flex-col items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#c7f36b] text-[#151a31] text-xl shadow-lg">
            ✦
          </span>
          <p className="text-sm font-medium text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  // Not logged in → redirect to login, preserve intended destination
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check (optional)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
