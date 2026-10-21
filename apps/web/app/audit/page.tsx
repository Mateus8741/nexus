"use client";

import { AdminTable } from "@/components/admin/admin-table";

export default function AuditPage() {
  return (
    <AdminTable
      title="Auditoria"
      description="Tudo o que aconteceu: logins, ações em dispositivos e tentativas negadas."
      queryKey="audit"
      path="/audit?limit=100"
      columns={[
        { key: "recordedAt", label: "Quando" },
        { key: "action", label: "Ação" },
        { key: "actorType", label: "Tipo" },
        { key: "actorId", label: "Ator" },
        { key: "outcome", label: "Resultado" },
        { key: "ip", label: "IP" },
        { key: "metadata", label: "Detalhes" },
      ]}
    />
  );
}
