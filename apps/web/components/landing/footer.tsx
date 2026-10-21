import Link from "next/link";

import { Brand } from "@/components/layout/brand";

const LINKS = [
  { href: "/login", label: "Entrar" },
  { href: "/cadastro", label: "Criar conta" },
  { href: "/downloads", label: "Downloads" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Brand />
          <p className="text-xs text-muted-foreground">
            Luzes, clima e computadores, num só lugar.
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex gap-6 text-sm text-muted-foreground">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nexus. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
