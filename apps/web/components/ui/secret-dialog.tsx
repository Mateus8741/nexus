"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useCallback, useState } from "react";

import { ActionButton } from "@/components/ui/form";

interface Secret {
  readonly title: string;
  readonly value: string;
}

/**
 * Mostra um segredo gerado uma única vez (API key, token de agent) num
 * modal com botão de copiar — no lugar do antigo window.prompt.
 */
export function useSecretDialog(): { dialog: ReactNode; show: (secret: Secret) => void } {
  const [secret, setSecret] = useState<Secret | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard indisponível: o usuário ainda consegue selecionar o texto
    }
  }, [secret]);

  const dialog = (
    <AnimatePresence>
      {secret && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={secret.title}
            className="glass glow-ring relative w-full max-w-lg rounded-2xl p-6"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-glow to-glow-2 text-background">
                <KeyRound className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">{secret.title}</h2>
                <p className="text-xs text-muted-foreground">
                  Copie agora — ele não será mostrado de novo.
                </p>
              </div>
            </div>
            <code className="block break-all rounded-xl border border-white/10 bg-black/30 p-3.5 font-mono text-xs leading-relaxed select-all">
              {secret.value}
            </code>
            <div className="mt-5 flex justify-end gap-2">
              <ActionButton variant="ghost" onClick={() => setSecret(null)}>
                Fechar
              </ActionButton>
              <ActionButton onClick={() => void copy()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copiado!" : "Copiar"}
              </ActionButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return { dialog, show: setSecret };
}
