"use client";

import { AdminTable } from "@/components/admin/admin-table";

export default function UsersPage() {
  return (
    <AdminTable
      title="Users"
      queryKey="users"
      path="/users"
      columns={[
        { key: "userId", label: "User ID" },
        { key: "roleKey", label: "Role" },
        { key: "createdAt", label: "Since" },
        { key: "user", label: "User" },
      ]}
    />
  );
}
