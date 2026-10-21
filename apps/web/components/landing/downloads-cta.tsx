"use client";

import { ArrowRight, Download, Info, Laptop, Monitor } from "lucide-react";
import Link from "next/link";

import { Rise, SectionHead, TiltCard } from "./shared";

const BUILDS = [
  { icon: Monitor, name: "Windows", detail: "Windows 10 ou superior · bandeja do sistema" },
  { icon: Laptop, name: "macOS Apple Silicon", detail: "M1, M2, M3 e M4 · barra de menus" },
  { icon: Laptop, name: "macOS Intel", detail: "Macs com processador Intel · barra de menus" },
];

export function DownloadsCta() {
  return (
    <section id="downloads" className="relative scroll-mt-20 px-5 py-24 sm:py-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <SectionHead
          eyebrow="Downloads"
          title={
            <>
              Leve o Nexus para a sua <span className="text-gradient">área de trabalho</span>
            </>
          }
          subtitle="Widget de controle rápido e agente para os seus computadores."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {BUILDS.map((b, i) => {
            const Icon = b.icon;
            return (
              <TiltCard key={b.name} delay={i * 0.08}>
                <Link
                  href="/downloads"
                  className="group flex h-full flex-col gap-4 p-6 outline-none"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-glow/15 text-glow transition-transform duration-300 group-hover:scale-110">
                    <Icon className="size-6" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold tracking-tight">{b.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{b.detail}</p>
                  </div>
                  <span className="flex items-center gap-2 text-sm font-medium text-glow">
                    <Download className="size-4" /> Baixar instalador
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </TiltCard>
            );
          })}
        </div>

        <Rise>
          <div className="glass glow-ring flex flex-col items-center gap-5 rounded-3xl p-8 text-center">
            <p className="flex items-center gap-2 text-sm text-muted-foreground sm:text-base">
              <Info className="size-4 shrink-0 text-glow" />
              <span>
                <strong className="text-foreground">Você pode baixar sem conta</strong>, mas precisa
                de uma conta para usar.
              </span>
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/cadastro"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-glow to-glow-2 px-6 py-3 text-sm font-semibold text-background shadow-[0_8px_30px_-8px_var(--glow)] transition-transform hover:scale-105 active:scale-95"
              >
                Criar conta
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login"
                className="glass inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:scale-105 active:scale-95"
              >
                Entrar
              </Link>
            </div>
          </div>
        </Rise>
      </div>
    </section>
  );
}
