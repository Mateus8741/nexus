"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ActionButton, Field, PageHeader, Panel, TextInput } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";

/**
 * Ambientes (Spaces) — ex.: "Casa da Mariana". Cada Space isola
 * dispositivos e usuários (ver Membership.spaceId e Device.spaceId).
 */
export default function SpacesPage() {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    try {
      await apiFetch("/spaces", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      await client.invalidateQueries({ queryKey: ["spaces"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar.");
    }
  }

  return (
    <RevealGroup className="flex flex-col gap-6">
      <RevealItem>
        <PageHeader
          title="Ambientes"
          description="Cada ambiente isola dispositivos e usuários — uma casa, um escritório, um datacenter."
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
            <Field label="Novo ambiente" className="min-w-64 flex-1">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Casa da Mariana"
                required
              />
            </Field>
            <ActionButton type="submit">
              <Plus className="size-4" /> Criar
            </ActionButton>
          </form>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </Panel>
      </RevealItem>
      <RevealItem>
        <AdminTable
          bare
          title="Ambientes"
          queryKey="spaces"
          path="/spaces"
          columns={[
            { key: "name", label: "Nome" },
            { key: "id", label: "ID" },
            { key: "createdAt", label: "Criado em" },
          ]}
        />
      </RevealItem>
    </RevealGroup>
  );
}
