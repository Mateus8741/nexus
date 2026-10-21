"use client";

import { AdminTable } from "@/components/admin/admin-table";

export default function RolesPage() {
  return (
    <AdminTable
      title="Papéis e permissões"
      description="O que cada papel pode ver e fazer neste workspace."
      queryKey="roles"
      path="/roles"
      columns={[
        { key: "name", label: "Nome" },
        { key: "key", label: "Chave" },
        { key: "system", label: "Sistema" },
        { key: "permissions", label: "Permissões" },
      ]}
    />
  );
}
