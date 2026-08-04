"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AdminTable } from "@/components/admin/admin-table";
import { apiFetch } from "@/lib/api";

interface RoleOption {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

interface SpaceOption {
  readonly id: string;
  readonly name: string;
}

export default function UsersPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [spaceId, setSpaceId] = useState("");

  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleOption[]>("/roles"),
  });
  const spaces = useQuery({
    queryKey: ["spaces"],
    queryFn: () => apiFetch<SpaceOption[]>("/spaces"),
  });

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void apiFetch("/users/invite", {
            method: "POST",
            body: JSON.stringify({
              email,
              password,
              name,
              roleKey,
              spaceId: spaceId || undefined,
            }),
          }).then(() => {
            setEmail("");
            setPassword("");
            setName("");
            setRoleKey("");
            setSpaceId("");
            window.location.reload();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Nome
          <input
            className="rounded border border-border bg-background px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            className="rounded border border-border bg-background px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Senha provisória
          <input
            type="password"
            minLength={8}
            className="rounded border border-border bg-background px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Papel
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecione...
            </option>
            {(roles.data ?? []).map((role) => (
              <option key={role.id} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ambiente (opcional)
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
          >
            <option value="">Sem restrição (vê tudo)</option>
            {(spaces.data ?? []).map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Convidar
        </button>
      </form>
      <AdminTable
        title="Users"
        queryKey="users"
        path="/users"
        columns={[
          { key: "userId", label: "User ID" },
          { key: "roleKey", label: "Role" },
          { key: "spaceId", label: "Ambiente" },
          { key: "createdAt", label: "Since" },
          { key: "user", label: "User" },
        ]}
      />
    </div>
  );
}
