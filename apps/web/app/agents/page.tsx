"use client";

import { AdminTable } from "@/components/admin/admin-table";
import { apiFetch } from "@/lib/api";

export default function AgentsPage() {
  return (
    <AdminTable
      title="Agents"
      queryKey="agents"
      path="/agents"
      columns={[
        { key: "agentId", label: "Agent ID" },
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
        { key: "version", label: "Version" },
        { key: "lastConnectedAt", label: "Last connected" },
        { key: "lastIp", label: "Last IP" },
      ]}
      renderActions={(row, reload) => (
        <div className="flex gap-2">
          {row.status === "approved" ? (
            <>
              <button
                type="button"
                className="text-xs underline"
                onClick={() =>
                  void apiFetch(`/agents/${row.agentId}/rotate-token`, { method: "POST" }).then(
                    (result) => {
                      const token = (result as { token?: string }).token;
                      if (token) window.prompt("Novo token (copie agora):", token);
                      reload();
                    },
                  )
                }
              >
                Rotate
              </button>
              <button
                type="button"
                className="text-xs text-red-400 underline"
                onClick={() =>
                  void apiFetch(`/agents/${row.agentId}/revoke`, { method: "POST" }).then(reload)
                }
              >
                Revoke
              </button>
            </>
          ) : null}
        </div>
      )}
    />
  );
}
