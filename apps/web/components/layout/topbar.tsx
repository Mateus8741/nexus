"use client";

import { Avatar, AvatarFallback } from "@nexus/ui/components/avatar";
import { useQuery } from "@tanstack/react-query";
import { Bell, Menu, Search } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { OPEN_PALETTE_EVENT } from "@/lib/ui-events";

interface TopbarProps {
  onOpenMobileNav: () => void;
}

interface MeResponse {
  readonly actor?: {
    readonly type: string;
    readonly id: string;
    readonly workspaceId: string;
    readonly roleKey?: string;
    readonly spaceId?: string;
    readonly spaceName?: string;
  };
}

/**
 * Barra superior. O indicador de ambiente reflete o Space real do usuário
 * (GET /me): sem restrição mostra "Todo o workspace".
 */
export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/me"),
  });
  const actor = me.data?.actor;
  const environmentLabel = actor?.spaceId
    ? (actor.spaceName ?? "Ambiente restrito")
    : "Todo o workspace";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-background/40 px-4 backdrop-blur-xl md:px-8">
      <button
        type="button"
        className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground md:hidden"
        onClick={onOpenMobileNav}
        aria-label="Abrir navegação"
      >
        <Menu className="size-4" />
      </button>

      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm">
        <span className="relative flex size-2">
          <span className="absolute inset-0 rounded-full bg-success [animation:pulse-ring_2s_ease-out_infinite]" />
          <span className="relative size-2 rounded-full bg-success" />
        </span>
        <span className="font-medium">{environmentLabel}</span>
      </div>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        className="ml-2 hidden max-w-sm flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-ring md:flex"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Buscar ou executar…</span>
        <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 text-[0.65rem]">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notificações"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <Bell className="size-4" />
        </button>
        <Avatar size="sm">
          <AvatarFallback>MT</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
