"use client";

import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "../layout/brand";

const LINKS = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#cenas", label: "Cenas" },
  { href: "#downloads", label: "Downloads" },
] as const;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5"
    >
      <nav
        aria-label="Principal"
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 ${
          scrolled || open
            ? "glass border border-white/10 shadow-lg shadow-black/30 backdrop-blur-xl"
            : "border border-transparent"
        }`}
      >
        <Brand />

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/downloads"
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Baixar app
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/5"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="rounded-xl bg-gradient-to-br from-glow to-glow-2 px-4 py-2 text-sm font-semibold text-background shadow-md shadow-glow/30 transition hover:brightness-110"
          >
            Criar conta
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="flex size-10 items-center justify-center rounded-lg transition hover:bg-white/10 md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="glass mx-auto mt-2 max-w-6xl rounded-2xl border border-white/10 p-3 shadow-xl backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-3 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <Link
                href="/login"
                className="rounded-xl border border-white/10 px-4 py-2.5 text-center text-sm font-medium"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="rounded-xl bg-gradient-to-br from-glow to-glow-2 px-4 py-2.5 text-center text-sm font-semibold text-background"
              >
                Criar conta
              </Link>
              <Link
                href="/downloads"
                className="col-span-2 rounded-xl px-4 py-2 text-center text-sm text-muted-foreground"
              >
                Baixar o app
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
