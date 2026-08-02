"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

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
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-sm flex-col gap-3 p-6">
      <h1 className="text-xl font-semibold">Setup inicial</h1>
      <p className="text-sm text-muted-foreground">Crie o Owner e o workspace padrão.</p>
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
          className="rounded border border-border bg-background px-3 py-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input
          className="rounded border border-border bg-background px-3 py-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Workspace
        <input
          className="rounded border border-border bg-background px-3 py-2"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Criando..." : "Criar Owner"}
      </button>
    </form>
  );
}
