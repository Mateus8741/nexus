"use client";

import { Check } from "lucide-react";

import { AdminTable } from "@/components/admin/admin-table";
import { ActionButton } from "@/components/ui/form";
import { useSecretDialog } from "@/components/ui/secret-dialog";
import { apiFetch } from "@/lib/api";

export default function PendingAgentsPage() {
  const { dialog, show } = useSecretDialog();

  return (
    <>
      {dialog}
      <AdminTable
        title="Agents pendentes"
        description="Máquinas que pediram para entrar. Aprove só as que você reconhece."
        queryKey="agents-pending"
        path="/agents/pending"
        columns={[
          { key: "name", label: "Nome" },
          { key: "agentId", label: "Agent ID" },
          { key: "providerHint", label: "Origem" },
          { key: "createdAt", label: "Solicitado" },
        ]}
        renderActions={(row, reload) => (
          <ActionButton
            className="h-8 px-3 text-xs"
            onClick={() =>
              void apiFetch<{ token?: string }>(`/agents/${row.agentId}/approve`, {
                method: "POST",
              }).then((result) => {
                if (result.token) show({ title: "Token permanente do agent", value: result.token });
                reload();
              })
            }
          >
            <Check className="size-3.5" /> Aprovar
          </ActionButton>
        )}
      />
    </>
  );
}
