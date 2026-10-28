import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// ─────────────────────────────────────────────────────────────
// ProtectedRoute
//   <ProtectedRoute>              → any logged-in user
//   <ProtectedRoute adminOnly>    → admins only
//
// The UI check is only for navigation; real authorization is always
// enforced by the server (cookie session + role check on every API).
// ─────────────────────────────────────────────────────────────

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isLoggedIn, isAdmin, authLoading } = useAuth();
  const location = useLocation();

  // Wait until the session has been restored from the cookie.
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="spinner-border text-warning" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Not logged in → login page (remember where the user was going).
  if (!isLoggedIn || !user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // Logged in but not an admin → back to the storefront.
  if (adminOnly && !isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

export default ProtectedRoute;