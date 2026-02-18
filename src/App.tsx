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

// ============================================
// Protected Route
// ============================================

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  role: "staff" | "admin" | "superadmin";
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

// ============================================
// Routes
// ============================================

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

      {/* DEFAULT */}
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

// ============================================
// MAIN APP
// ============================================

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
