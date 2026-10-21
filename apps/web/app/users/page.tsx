"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import { AdminTable } from "@/components/admin/admin-table";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import {
  ActionButton,
  Field,
  PageHeader,
  Panel,
  SelectInput,
  TextInput,
} from "@/components/ui/form";
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
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const roles = useQuery({ queryKey: ["roles"], queryFn: () => apiFetch<RoleOption[]>("/roles") });
  const spaces = useQuery({
    queryKey: ["spaces"],
    queryFn: () => apiFetch<SpaceOption[]>("/spaces"),
  });

  async function invite() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/users/invite", {
        method: "POST",
        body: JSON.stringify({ email, password, name, roleKey, spaceId: spaceId || undefined }),
      });
      setEmail("");
      setPassword("");
      setName("");
      setRoleKey("");
      setSpaceId("");
      await client.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao convidar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevealGroup className="flex flex-col gap-6">
      <RevealItem>
        <PageHeader
          title="Usuários"
          description="Convide pessoas e limite cada uma a um ambiente, se quiser."
        />
      </RevealItem>
      <RevealItem>
        <Panel>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              void invite();
            }}
          >
            <Field label="Nome">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Email">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Senha provisória">
              <TextInput
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <Field label="Papel">
              <SelectInput value={roleKey} onChange={(e) => setRoleKey(e.target.value)} required>
                <option value="" disabled>
                  Selecione…
                </option>
                {(roles.data ?? []).map((role) => (
                  <option key={role.id} value={role.key}>
                    {role.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Ambiente (opcional)">
              <SelectInput value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
                <option value="">Sem restrição (vê tudo)</option>
                {(spaces.data ?? []).map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="flex items-end">
              <ActionButton type="submit" disabled={saving} className="w-full">
                <UserPlus className="size-4" />
                {saving ? "Convidando…" : "Convidar"}
              </ActionButton>
            </div>
            {error && <p className="text-sm text-destructive sm:col-span-full">{error}</p>}
          </form>
        </Panel>
      </RevealItem>
      <RevealItem>
        <AdminTable
          bare
          title="Usuários"
          queryKey="users"
          path="/users"
          columns={[
            { key: "user", label: "Usuário" },
            { key: "userId", label: "ID" },
            { key: "roleKey", label: "Papel" },
            { key: "spaceId", label: "Ambiente" },
            { key: "createdAt", label: "Desde" },
          ]}
        />
      </RevealItem>
    </RevealGroup>
  );
}
