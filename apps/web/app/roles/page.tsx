"use client";

import { AdminTable } from "@/components/admin/admin-table";

export default function RolesPage() {
  return (
    <AdminTable
      title="Roles & Permissions"
      queryKey="roles"
      path="/roles"
      columns={[
        { key: "key", label: "Key" },
        { key: "name", label: "Name" },
        { key: "system", label: "System" },
        { key: "permissions", label: "Permissions" },
      ]}
    />
  );
}
