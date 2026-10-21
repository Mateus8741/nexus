"use client";

import { Avatar, AvatarFallback } from "@nexus/ui/components/avatar";
import { useQuery } from "@tanstack/react-query";
import { Globe, LogOut } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

function initialsOf(name?: string, email?: string): string {
  const source = (name?.trim() || email?.split("@")[0] || "").trim();
  if (!source) return "MT";
  const parts = source.split(/\s+/);
  const letters =
    parts.length > 1 ? `${parts[0]?.[0]}${parts[parts.length - 1]?.[0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

/** Avatar da barra superior com menu: dados da conta, ir ao site e sair. */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const session = useQuery({
    queryKey: ["session-user"],
    queryFn: async () => (await authClient.getSession()).data?.user ?? null,
  });
  const user = session.data;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setLeaving(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Menu da conta"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-full outline-none ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar size="sm">
          <AvatarFallback>{initialsOf(user?.name, user?.email)}</AvatarFallback>
        </Avatar>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="glass absolute right-0 top-full z-50 bg-background/95 mt-2 w-64 origin-top-right rounded-2xl border border-white/10 p-2 shadow-xl"
          >
            <div className="px-3 py-2">
              <div className="truncate text-sm font-medium">{user?.name ?? "Minha conta"}</div>
              {user?.email && (
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              )}
            </div>
            <div className="my-1 h-px bg-white/10" />
            <Link
              href="/"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
            >
              <Globe className="size-4" />
              Ir para o site
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={leaving}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
            >
              <LogOut className="size-4" />
              {leaving ? "Saindo…" : "Sair"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
