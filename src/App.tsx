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
import SupremoDashboard from "./components/Supremodashboard";

// ── NEW: ChatRoom import ─────────────────────────────────────────────────────
import { ChatRoom } from "./components/ChatRoom";
import { FloatingChatButton } from "./components/FloatingChatButton";

// ── NEW: CommandCenter import ────────────────────────────────────────────────
import CommandCenter from "./components/CommandCenter/CommandCenter";

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  role: "staff" | "admin" | "superadmin" | "supremo";
}> = ({ children, role }) => {
  const { user } = useUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return <>{children}</>;
};

// ── Chat accessible to all authenticated users ───────────────────────────────
const AuthedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useUser();

  return (
    <>
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

      {/* SUPREMO */}
      <Route
        path="/supremo"
        element={
          <ProtectedRoute role="supremo">
            <SupremoDashboard />
          </ProtectedRoute>
        }
      />

      {/* ── CHAT — all authenticated roles ──────────────────────────────── */}
      <Route
        path="/chat"
        element={
          <AuthedRoute>
            <ChatRoom />
          </AuthedRoute>
        }
      />

      {/* ── COMMAND CENTER — supremo only ────────────────────────────────── */}
      <Route
        path="/command-center"
        element={
          <ProtectedRoute role="supremo">
            <CommandCenter currentUser={user ? { _id: user.id || (user as any)._id || "", name: user.name || "", email: user.email || "" } : undefined} apiBase={process.env.REACT_APP_API_URL || "https://api.roswaltsmartcue.com"} />
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

      {/* ── Floating chat button — visible on all authenticated pages ── */}
      <FloatingChatButton />
    </>
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
