import React from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { UserProvider, useUser } from "./contexts/UserContext";
import Login from "./components/Login";
import StaffDashboard from "./components/StaffDashboard";
import AdminDashboard from "./components/AdminDashboard";
import SADashboard from "./components/SADashboard";
// ── CHANGE 1: Import SupremoDashboard ────────────────────────────────────────
import SupremoDashboard from "./components/Supremodashboard";

// ── CHANGE 2: role prop now accepts "supremo" ────────────────────────────────
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  role: "staff" | "admin" | "superadmin" | "supremo";
}> = ({ children, role }) => {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useUser();

  return (
    <Routes>
      {/* LOGIN */}
      <Route
        path="/login"
        element={user ? <Navigate to={`/${user.role}`} replace /> : <Login />}
      />

      {/* STAFF */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute role="staff">
            <StaffDashboard />
          </ProtectedRoute>
        }
      />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* SUPERADMIN */}
      <Route
        path="/superadmin"
        element={
          <ProtectedRoute role="superadmin">
            <SADashboard />
          </ProtectedRoute>
        }
      />

      {/* ── CHANGE 3: Supremo route ──────────────────────────────────────── */}
      <Route
        path="/supremo"
        element={
          <ProtectedRoute role="supremo">
            <SupremoDashboard />
          </ProtectedRoute>
        }
      />

      {/* DEFAULT — falls through to /{role} which covers /supremo too */}
      <Route
        path="*"
        element={
          user ? (
            <Navigate to={`/${user.role}`} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <UserProvider>
      <Router>
        <AppRoutes />
      </Router>
    </UserProvider>
  );
};

export default App;