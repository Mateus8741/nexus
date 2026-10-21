"use client";

import { LogIn } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ActionButton, Field, TextInput } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "Falha no login");
      return;
    }
    try {
      const base = process.env.NEXT_PUBLIC_NEXUS_CORE_URL ?? "http://localhost:4700";
      const me = await fetch(`${base}/me`, { credentials: "include" });
      if (me.status === 401) {
        router.push("/conta-criada");
        router.refresh();
        return;
      }
    } catch {
      // Core inacessível: segue o fluxo normal.
    }
    router.push(searchParams.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Email">
        <TextInput
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </Field>
      <Field label="Senha">
        <TextInput
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </Field>
      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -4, 4, 0] }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <ActionButton type="submit" disabled={loading} className="mt-1">
        <LogIn className="size-4" />
        {loading ? "Entrando…" : "Entrar"}
      </ActionButton>
      <p className="text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link href="/cadastro" className="text-glow hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
