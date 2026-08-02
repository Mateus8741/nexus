"use client";

import { useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { apiFetch } from "@/lib/api";

export default function ApiKeysPage() {
  const [name, setName] = useState("");

  return (
    <div className="space-y-4">
      <form
        className="flex items-end gap-2 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void apiFetch<{ token: string }>("/api-keys", {
            method: "POST",
            body: JSON.stringify({
              name,
              scopes: [
                "device.read",
                "device.write",
                "action.shutdown",
                "action.restart",
                "action.lock",
                "action.executeCommand",
              ],
            }),
          }).then((result) => {
            window.prompt("API Key (copie agora):", result.token);
            setName("");
            window.location.reload();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Nova API Key
          <input
            className="rounded border border-border bg-background px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Criar
        </button>
      </form>
      <AdminTable
        title="API Keys"
        queryKey="api-keys"
        path="/api-keys"
        columns={[
          { key: "name", label: "Name" },
          { key: "prefix", label: "Prefix" },
          { key: "createdAt", label: "Created" },
          { key: "lastUsedAt", label: "Last used" },
          { key: "revokedAt", label: "Revoked" },
        ]}
        renderActions={(row, reload) =>
          row.revokedAt ? null : (
            <button
              type="button"
              className="text-xs text-red-400 underline"
              onClick={() =>
                void apiFetch(`/api-keys/${row.id}`, { method: "DELETE" }).then(reload)
              }
            >
              Revoke
            </button>
          )
        }
      />
    </div>
  );
}
