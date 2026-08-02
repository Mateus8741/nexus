"use client";

import { Avatar, AvatarFallback } from "@nexus/ui/components/avatar";
import { Button } from "@nexus/ui/components/button";
import { Input } from "@nexus/ui/components/input";
import { Bell, ChevronsUpDown, Menu, Search } from "lucide-react";

interface TopbarProps {
  onOpenMobileNav: () => void;
}

/**
 * Barra superior fixa. Seletor de ambiente, busca, notificações e usuário
 * são só visuais — nada disso está conectado a dados reais ainda.
 */
export function Topbar({ onOpenMobileNav }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onOpenMobileNav}
        aria-label="Abrir navegação"
      >
        <Menu className="size-4" />
      </Button>

      <button
        type="button"
        aria-disabled="true"
        className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground opacity-80 hover:bg-accent"
      >
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="font-medium">Ambiente Principal</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </button>

      <div className="ml-2 hidden max-w-sm flex-1 items-center md:flex">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar ambientes, dispositivos..." className="pl-8" disabled />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Notificações">
          <Bell className="size-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Avatar size="sm">
          <AvatarFallback>MT</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
