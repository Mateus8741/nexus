"use client";

import { useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ActionButton, Field, PageHeader, Panel, TextInput } from "@/components/ui/form";
import { useSecretDialog } from "@/components/ui/secret-dialog";
import { apiFetch } from "@/lib/api";

/** Escopos concedidos às chaves criadas aqui (o Nexus Desktop usa para ler e controlar dispositivos). */
const DEFAULT_SCOPES = [
  "device.read",
  "device.write",
  "action.shutdown",
  "action.restart",
  "action.lock",
  "action.executeCommand",
];

export default function ApiKeysPage() {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { dialog, show } = useSecretDialog();

  async function create() {
    setError(null);
    try {
      const result = await apiFetch<{ token: string }>("/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes: DEFAULT_SCOPES }),
      });
      show({ title: "Nova API Key", value: result.token });
      setName("");
      await client.invalidateQueries({ queryKey: ["api-keys"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar a chave.");
    }
  }

  return (
    <RevealGroup className="flex flex-col gap-6">
      {dialog}
      <RevealItem>
        <PageHeader
          title="API Keys"
          description="Chaves para o Nexus Desktop, widgets e integrações acessarem o Core. Cole a chave no app ao parear."
        />
      </RevealItem>
      <RevealItem>
        <Panel>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <Field label="Nome da chave" className="min-w-64 flex-1">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Widget do MacBook"
                required
              />
            </Field>
            <ActionButton type="submit">
              <KeyRound className="size-4" /> Gerar chave
            </ActionButton>
          </form>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </Panel>
      </RevealItem>
      <RevealItem>
        <AdminTable
          bare
          title="API Keys"
          queryKey="api-keys"
          path="/api-keys"
          columns={[
            { key: "name", label: "Nome" },
            { key: "prefix", label: "Prefixo" },
            { key: "createdAt", label: "Criada" },
            { key: "lastUsedAt", label: "Último uso" },
            { key: "revokedAt", label: "Revogada" },
          ]}
          renderActions={(row, reload) =>
            row.revokedAt ? null : (
              <ActionButton
                variant="danger"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  void apiFetch(`/api-keys/${row.id}`, { method: "DELETE" }).then(reload)
                }
              >
                Revogar
              </ActionButton>
            )
          }
        />
      </RevealItem>
    </RevealGroup>
  );
}
