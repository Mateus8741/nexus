"use client";

import { cn } from "@nexus/ui/lib/utils";
import { motion } from "motion/react";
import Link from "next/link";

import type { NavItem } from "./nav-items";

interface NavLinkProps {
  readonly item: NavItem;
  readonly active: boolean;
  readonly collapsed?: boolean;
  readonly pillId: string;
  readonly onNavigate?: () => void;
}

/** Item de navegação com pill ativa que desliza entre itens (layoutId). */
export function NavLink({ item, active, collapsed, pillId, onNavigate }: NavLinkProps) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-disabled={!item.implemented}
      aria-current={active ? "page" : undefined}
      tabIndex={item.implemented ? 0 : -1}
      onClick={() => item.implemented && onNavigate?.()}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        item.implemented && "hover:text-foreground",
        active && "text-foreground",
        !item.implemented && "pointer-events-none opacity-45",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <motion.span
          layoutId={pillId}
          className="glow-ring absolute inset-0 rounded-xl bg-gradient-to-r from-glow/25 to-glow-2/10"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <Icon className="relative size-4 shrink-0 transition-transform group-hover:scale-110" />
      {!collapsed && <span className="relative truncate">{item.label}</span>}
      {!collapsed && !item.implemented && (
        <span className="relative ml-auto rounded-full bg-white/5 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide">
          em breve
        </span>
      )}
    </Link>
  );
}
