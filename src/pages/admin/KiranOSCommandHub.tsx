import React from "react";
import KiranOSChat from "@components/KiranOSChat";
import AuthenticatedLayout from "@/layouts/AuthenticatedLayout";

const KiranOSCommandHub: React.FC = () => {
  return (
    <AuthenticatedLayout requiredRoles={["admin", "founder"]}>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">KiranOS Command Hub</h1>
        <KiranOSChat />
      </div>
    </AuthenticatedLayout>
  );
};

export default KiranOSCommandHub;
