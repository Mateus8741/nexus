"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

import { Brand } from "./brand";
import { navSections } from "./nav-items";
import { NavLink } from "./nav-link";

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Gaveta de navegação para telas pequenas. */
export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.button
            type="button"
            aria-label="Fechar navegação"
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Navegação"
            className="glass absolute inset-y-0 left-0 flex w-72 flex-col rounded-none border-y-0 border-l-0"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
          >
            <div className="flex h-16 shrink-0 items-center justify-between px-4">
              <Brand href="/dashboard" />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Fechar navegação"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2">
              {navSections.map((section) => (
                <div key={section.title} className="flex flex-col gap-0.5">
                  <span className="px-2.5 pb-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                    {section.title}
                  </span>
                  {section.items.map((item) => (
                    <NavLink
                      key={item.label}
                      item={item}
                      pillId="nav-pill-mobile"
                      active={item.implemented && pathname === item.href}
                      onNavigate={() => onOpenChange(false)}
                    />
                  ))}
                </div>
              ))}
            </nav>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
