"use client";

import { ScrollArea } from "@nexus/ui/components/scroll-area";
import { cn } from "@nexus/ui/lib/utils";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navSections } from "./nav-items";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * Sidebar fixa (desktop). Some no mobile — ver mobile-sidebar.tsx para o
 * equivalente em telas pequenas.
 */
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            N
          </span>
          {!collapsed && <span>Nexus</span>}
        </Link>
      </div>

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-4 p-2">
          {navSections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              {!collapsed && (
                <span className="px-2 pt-1 text-xs font-medium text-muted-foreground">
                  {section.title}
                </span>
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.href && item.implemented;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-disabled={!item.implemented}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors",
                      item.implemented && "hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent text-accent-foreground",
                      !item.implemented && "pointer-events-none opacity-50",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
