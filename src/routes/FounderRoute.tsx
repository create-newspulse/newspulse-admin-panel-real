// 📁 src/routes/FounderRoute.tsx

import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const FounderRoute = ({ children }: Props) => {
  const user = JSON.parse(localStorage.getItem("adminUser") || "{}");
  const isFounder = localStorage.getItem("isFounder") === "true";

  if (!user?.role || user.role !== "founder" || !isFounder) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

export default FounderRoute;
