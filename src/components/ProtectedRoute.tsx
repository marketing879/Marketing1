import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

interface Props {
  children: JSX.Element;
  role?: "staff" | "admin" | "superadmin";
}

const ProtectedRoute: React.FC<Props> = ({ children, role }) => {
  const { user, authLoading } = useUser();

  if (authLoading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;
