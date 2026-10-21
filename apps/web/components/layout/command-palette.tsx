"use client";

import type { LucideIcon } from "lucide-react";
import { CornerDownLeft, LogOut, RefreshCw, Search, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { SCENES } from "@/lib/devices/scenes";
import { OPEN_PALETTE_EVENT, requestScene } from "@/lib/ui-events";
import { navSections } from "./nav-items";

interface Command {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly icon: LucideIcon;
  readonly run: () => void;
}

/** ⌘K / Ctrl+K — navegação e ações rápidas (cenas, atualizar, sair). */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const show = () => {
      setQuery("");
      setCursor(0);
      setOpen(true);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => {
          if (!value) {
            setQuery("");
            setCursor(0);
          }
          return !value;
        });
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = show;
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  const commands = useMemo<Command[]>(() => {
    const nav = navSections.flatMap((section) =>
      section.items
        .filter((item) => item.implemented)
        .map<Command>((item) => ({
          id: `nav:${item.href}`,
          label: item.label,
          group: "Ir para",
          icon: item.icon,
          run: () => router.push(item.href),
        })),
    );
    const scenes = SCENES.map<Command>((scene) => ({
      id: `scene:${scene.id}`,
      label: `Cena: ${scene.label}`,
      group: "Cenas",
      icon: Sparkles,
      run: () => {
        router.push("/dashboard");
        setTimeout(() => requestScene(scene.id), 450);
      },
    }));
    const system: Command[] = [
      {
        id: "refresh",
        label: "Atualizar dados",
        group: "Sistema",
        icon: RefreshCw,
        run: () => router.refresh(),
      },
      {
        id: "logout",
        label: "Sair",
        group: "Sistema",
        icon: LogOut,
        run: () => void authClient.signOut().then(() => (window.location.href = "/login")),
      },
    ];
    return [...scenes, ...nav, ...system];
  }, [router]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? commands.filter((c) => c.label.toLowerCase().includes(needle)) : commands;
  }, [commands, query]);

  function execute(command: Command | undefined) {
    if (!command) return;
    setOpen(false);
    command.run();
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[14vh]">
          <motion.button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos"
            className="glass glow-ring relative w-full max-w-xl overflow-hidden rounded-2xl"
            initial={{ opacity: 0, scale: 0.94, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                // biome-ignore lint/a11y/noAutofocus: o input só monta quando a paleta abre
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCursor((value) => Math.min(value + 1, filtered.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCursor((value) => Math.max(value - 1, 0));
                  } else if (event.key === "Enter") {
                    execute(filtered[cursor]);
                  }
                }}
                placeholder="Buscar páginas, cenas e ações…"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                esc
              </kbd>
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nada encontrado.
                </li>
              )}
              {filtered.map((command, index) => {
                const Icon = command.icon;
                const active = index === cursor;
                return (
                  <li key={command.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => execute(command)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        active ? "bg-white/10 text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span className="flex-1">{command.label}</span>
                      <span className="text-[0.65rem] uppercase tracking-wider opacity-60">
                        {command.group}
                      </span>
                      {active && <CornerDownLeft className="size-3.5 opacity-60" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
