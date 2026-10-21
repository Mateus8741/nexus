"use client";

import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ActionButton, Field, TextInput } from "@/components/ui/form";
import { CORE_URL } from "@/lib/api";

export function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Default Workspace");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${CORE_URL}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password, workspaceName }),
      });
      const body = (await response.json()) as { error?: unknown };
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : "Falha no setup");
        setLoading(false);
        return;
      }
      router.push("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.includes("Failed to fetch")
          ? `Não foi possível alcançar o Core em ${CORE_URL}. Confirme que o plugin-host está rodando.`
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Nome">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Senha">
        <TextInput
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </Field>
      <Field label="Workspace">
        <TextInput
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          required
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ActionButton type="submit" disabled={loading} className="mt-1">
        <Rocket className="size-4" />
        {loading ? "Criando…" : "Criar Owner"}
      </ActionButton>
    </form>
  );
}
