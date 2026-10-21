"use client";

import { RefreshCw } from "lucide-react";

import { AdminTable } from "@/components/admin/admin-table";
import { ActionButton } from "@/components/ui/form";
import { useSecretDialog } from "@/components/ui/secret-dialog";
import { apiFetch } from "@/lib/api";

export default function AgentsPage() {
  const { dialog, show } = useSecretDialog();

  return (
    <>
      {dialog}
      <AdminTable
        title="Agents"
        description="Computadores com o Nexus Desktop instalado e aprovados para este workspace."
        queryKey="agents"
        path="/agents"
        columns={[
          { key: "name", label: "Nome" },
          { key: "agentId", label: "Agent ID" },
          { key: "status", label: "Status" },
          { key: "version", label: "Versão" },
          { key: "lastConnectedAt", label: "Última conexão" },
          { key: "lastIp", label: "Último IP" },
        ]}
        renderActions={(row, reload) =>
          row.status === "approved" ? (
            <div className="flex justify-end gap-2">
              <ActionButton
                variant="ghost"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  void apiFetch<{ token?: string }>(`/agents/${row.agentId}/rotate-token`, {
                    method: "POST",
                  }).then((result) => {
                    if (result.token) show({ title: "Novo token do agent", value: result.token });
                    reload();
                  })
                }
              >
                <RefreshCw className="size-3.5" /> Girar token
              </ActionButton>
              <ActionButton
                variant="danger"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  void apiFetch(`/agents/${row.agentId}/revoke`, { method: "POST" }).then(reload)
                }
              >
                Revogar
              </ActionButton>
            </div>
          ) : null
        }
      />
    </>
  );
}
