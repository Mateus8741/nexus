"use client";

import { AdminTable } from "@/components/admin/admin-table";
import { apiFetch } from "@/lib/api";

export default function PendingAgentsPage() {
  return (
    <AdminTable
      title="Pending Agents"
      queryKey="agents-pending"
      path="/agents/pending"
      columns={[
        { key: "agentId", label: "Agent ID" },
        { key: "name", label: "Name" },
        { key: "providerHint", label: "Provider" },
        { key: "createdAt", label: "Requested" },
      ]}
      renderActions={(row, reload) => (
        <button
          type="button"
          className="text-xs underline"
          onClick={() =>
            void apiFetch(`/agents/${row.agentId}/approve`, { method: "POST" }).then((result) => {
              const token = (result as { token?: string }).token;
              if (token) {
                window.prompt(
                  "Token permanente (copie agora — também enviado ao Agent se conectado):",
                  token,
                );
              }
              reload();
            })
          }
        >
          Approve
        </button>
      )}
    />
  );
}
