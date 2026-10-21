"use client";

import { cn } from "@nexus/ui/lib/utils";
import { motion } from "motion/react";

export interface SpaceTab {
  readonly id: string;
  readonly label: string;
}

interface SpaceTabsProps {
  readonly tabs: readonly SpaceTab[];
  readonly value: string;
  readonly onChange: (id: string) => void;
}

/** Abas por ambiente com pill deslizante (layout animation). */
export function SpaceTabs({ tabs, value, onChange }: SpaceTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Ambientes"
      className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-1.5 text-sm text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-foreground" : "hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="space-pill"
                className="absolute inset-0 rounded-full border border-white/15 bg-white/10"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
