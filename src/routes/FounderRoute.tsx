// 📁 src/routes/FounderRoute.tsx

import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const FounderRoute = ({ children }: Props) => {

  const user = JSON.parse(localStorage.getItem("adminUser") || "null");
  const isFounder = localStorage.getItem("isFounder") === "true";

  // If there is no user, redirect to login so a preview can show the login screen
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // If user exists but is not a founder, show unauthorized
  if (!user?.role || user.role !== "founder" || !isFounder) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default FounderRoute;
