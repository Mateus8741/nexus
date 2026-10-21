"use client";

import { Download, LogOut, MailCheck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Brand } from "@/components/layout/brand";
import { ActionButton } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

export function ContaCriada() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function handleSignOut() {
    setLeaving(true);
    try {
      await authClient.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center px-5 py-10">
      <div className="grid-bg absolute inset-0 -z-10" aria-hidden="true" />
      <div className="absolute top-6 left-6">
        <Brand />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="glass glow-ring w-full max-w-md rounded-3xl p-8 text-center"
      >
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-glow to-glow-2 text-background">
          <MailCheck className="size-7" />
        </span>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.16em] text-glow">
          Conta criada
        </p>
        <h1 className="text-gradient mt-1 text-3xl font-semibold tracking-tight">
          Falta só o acesso
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sua conta está pronta, mas ainda não está vinculada a nenhum ambiente. Peça ao
          administrador para convidar você em Usuários, usando o mesmo email da conta. Assim que o
          convite for feito, é só entrar de novo.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <Link href="/downloads" className="contents">
            <ActionButton type="button">
              <Download className="size-4" />
              Baixar o app
            </ActionButton>
          </Link>
          <ActionButton type="button" variant="ghost" onClick={handleSignOut} disabled={leaving}>
            <LogOut className="size-4" />
            {leaving ? "Saindo…" : "Entrar com outra conta"}
          </ActionButton>
        </div>
      </motion.div>
    </main>
  );
}
