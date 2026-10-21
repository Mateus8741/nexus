"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";

import { Brand } from "./brand";
import { navSections } from "./nav-items";
import { NavLink } from "./nav-link";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/** Sidebar fixa (desktop) que encolhe com animação de mola. */
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="glass sticky top-0 hidden h-svh shrink-0 flex-col rounded-none border-y-0 border-l-0 md:flex"
    >
      <div className="flex h-16 shrink-0 items-center px-4">
        <Brand compact={collapsed} />
      </div>

      <nav
        className="flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-3 py-2"
        aria-label="Principal"
      >
        {navSections.map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            {!collapsed && (
              <span className="px-2.5 pb-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                {section.title}
              </span>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.label}
                item={item}
                collapsed={collapsed}
                pillId="nav-pill-desktop"
                active={item.implemented && pathname === item.href}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="shrink-0 p-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </motion.aside>
  );
}
