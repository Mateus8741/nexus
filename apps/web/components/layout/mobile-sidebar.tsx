"use client";

import { cn } from "@nexus/ui/lib/utils";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navSections } from "./nav-items";

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drawer de navegação para telas pequenas. Implementado com CSS puro
 * (overlay + translate) em vez do primitivo Sheet/Dialog — evita depender de
 * portal/foco de um Dialog para uma simples gaveta de navegação.
 */
export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn("fixed inset-0 z-50 md:hidden", !open && "pointer-events-none")}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Fechar navegação"
        tabIndex={open ? 0 : -1}
        className={cn(
          "absolute inset-0 cursor-default bg-black/60 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={() => onOpenChange(false)}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navegação"
        className={cn(
          "absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-card shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="font-semibold tracking-tight text-foreground">Nexus</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar navegação"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2">
          {navSections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <span className="px-2 pt-1 text-xs font-medium text-muted-foreground">
                {section.title}
              </span>
              {section.items.map((item) => {
                const isActive = pathname === item.href && item.implemented;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-disabled={!item.implemented}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => item.implemented && onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground",
                      item.implemented && "hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent text-accent-foreground",
                      !item.implemented && "pointer-events-none opacity-50",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}
