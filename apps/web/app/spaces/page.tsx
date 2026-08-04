"use client";

import { useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { apiFetch } from "@/lib/api";

/**
 * Ambientes (Spaces) — ex.: "Casa da Mariana", "Casa do Matt". Cada Space é
 * o que isola dispositivos e usuários entre si (ver Membership.spaceId e
 * Device.spaceId): um usuário restrito a um Space só enxerga e controla
 * dispositivos desse ambiente.
 */
export default function SpacesPage() {
  const [name, setName] = useState("");

  return (
    <div className="space-y-4">
      <form
        className="flex items-end gap-2 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void apiFetch("/spaces", {
            method: "POST",
            body: JSON.stringify({ name }),
          }).then(() => {
            setName("");
            window.location.reload();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Novo ambiente
          <input
            className="rounded border border-border bg-background px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Casa da Mariana"
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
        title="Ambientes"
        queryKey="spaces"
        path="/spaces"
        columns={[
          { key: "name", label: "Nome" },
          { key: "id", label: "ID" },
          { key: "createdAt", label: "Criado em" },
        ]}
      />
    </div>
  );
}
