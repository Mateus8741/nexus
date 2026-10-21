"use client";

import {
  Apple,
  ArrowRight,
  Download,
  LayoutGrid,
  LogIn,
  MonitorSmartphone,
  ShieldCheck,
  UserPlus,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { Spotlight } from "@/components/motion/spotlight";
import { PageHeader } from "@/components/ui/form";
import { useClientValue } from "@/lib/use-client-value";

const VERSION = "0.1.0";
/** Instaladores publicados como GitHub Release (repo público); sobrescreva por env se mudar de host. */
const BASE_URL = (
  process.env.NEXT_PUBLIC_NEXUS_DOWNLOAD_BASE_URL ??
  `https://github.com/Mateus8741/nexus/releases/download/desktop-v${VERSION}`
).replace(/\/$/, "");

type Platform = "windows" | "mac-arm" | "mac-intel";

interface Installer {
  readonly id: Platform;
  readonly name: string;
  readonly detail: string;
  readonly file: string;
  readonly icon: typeof Apple;
}

const INSTALLERS: readonly Installer[] = [
  {
    id: "windows",
    name: "Windows",
    detail: "Windows 10 ou 11 · 64 bits",
    file: `Nexus-Setup-${VERSION}.exe`,
    icon: LayoutGrid,
  },
  {
    id: "mac-arm",
    name: "macOS · Apple Silicon",
    detail: "M1, M2, M3, M4 · macOS 12+",
    file: `Nexus-${VERSION}-arm64.dmg`,
    icon: Apple,
  },
  {
    id: "mac-intel",
    name: "macOS · Intel",
    detail: "Macs com processador Intel · macOS 12+",
    file: `Nexus-${VERSION}-x64.dmg`,
    icon: Apple,
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Agent em segundo plano",
    text: "Inicia com o sistema e deixa o computador controlável pelo Nexus — bloquear, reiniciar, desligar.",
  },
  {
    icon: MonitorSmartphone,
    title: "Widget na bandeja / barra de menu",
    text: "Cenas, luzes e clima a um clique, sem abrir o navegador.",
  },
  {
    icon: ShieldCheck,
    title: "Pareamento seguro",
    text: "Cada máquina entra como pendente e só funciona depois que você aprova.",
  },
];

const STEPS = [
  { title: "Baixe e instale", text: "Escolha o instalador do seu sistema e siga o assistente." },
  {
    title: "Gere uma API Key",
    text: "Em API Keys, crie uma chave para este computador.",
    href: "/api-keys",
    cta: "Abrir API Keys",
  },
  { title: "Pareie o app", text: "Abra o Nexus Desktop e cole o endereço do Core e a chave." },
  {
    title: "Aprove a máquina",
    text: "Ela aparece em Agents pendentes — é só aprovar.",
    href: "/agents/pending",
    cta: "Ver pendentes",
  },
];

function detectPlatform(): Platform | null {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac")) return "mac-arm";
  return null;
}

function GuestBar() {
  return (
    <header className="flex items-center justify-between gap-3 pb-2">
      <Brand />
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium transition-colors hover:bg-white/10"
        >
          <LogIn className="size-4" />
          Entrar
        </Link>
        <Link
          href="/cadastro"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-glow to-glow-2 px-4 text-sm font-medium text-background shadow-[0_8px_24px_-8px_var(--glow)] transition-[filter] hover:brightness-110"
        >
          <UserPlus className="size-4" />
          Criar conta
        </Link>
      </div>
    </header>
  );
}

function GuestNotice() {
  return (
    <RevealItem>
      <div className="glass glow-ring flex flex-col gap-4 rounded-3xl p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-glow to-glow-2 text-background">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <h2 className="text-gradient text-xl font-semibold tracking-tight">
              Você precisa de uma conta para usar o Nexus
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Você pode baixar o instalador agora, mas o app só funciona com uma conta. Crie a sua
              em instantes ou entre se já tiver uma.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/cadastro"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-glow to-glow-2 px-4 text-sm font-medium text-background shadow-[0_8px_24px_-8px_var(--glow)] transition-[filter] hover:brightness-110"
          >
            Criar conta
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium transition-colors hover:bg-white/10"
          >
            Entrar
          </Link>
        </div>
      </div>
    </RevealItem>
  );
}

export function DownloadsView({ guest = false }: { guest?: boolean }) {
  const detected = useClientValue(detectPlatform, null);

  return (
    <RevealGroup
      className={
        guest ? "mx-auto flex max-w-6xl flex-col gap-10 p-5 md:p-8" : "flex flex-col gap-10"
      }
    >
      {guest && (
        <RevealItem>
          <GuestBar />
        </RevealItem>
      )}
      {guest && <GuestNotice />}
      <RevealItem>
        <PageHeader
          title="Nexus Desktop"
          description={`Instale o agent e o widget no Windows ou no Mac. Versão ${VERSION}.`}
        />
      </RevealItem>

      <RevealItem className="grid gap-4 md:grid-cols-3">
        {INSTALLERS.map((installer) => {
          const recommended = detected === installer.id;
          const Icon = installer.icon;
          return (
            <Spotlight
              key={installer.id}
              className={`relative flex flex-col gap-5 p-6 ${recommended ? "glow-ring" : ""}`}
              whileHover={{ y: -4 }}
            >
              {recommended && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-4 right-4 rounded-full bg-glow/20 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-glow"
                >
                  Recomendado
                </motion.span>
              )}
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-glow to-glow-2 text-background">
                <Icon className="size-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">{installer.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{installer.detail}</p>
              </div>
              <a
                href={`${BASE_URL}/${installer.file}`}
                download
                className="group mt-auto inline-flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 truncate">{installer.file}</span>
                <Download className="size-4 shrink-0 transition-transform group-hover:translate-y-0.5" />
              </a>
            </Spotlight>
          );
        })}
      </RevealItem>

      <RevealItem className="grid gap-4 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3.5 px-1">
            <Icon className="mt-0.5 size-5 shrink-0 text-glow" />
            <div>
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </RevealItem>

      <RevealItem>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Como parear
        </h2>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, index) => (
            <Spotlight key={step.title} className="flex flex-col gap-2 p-5">
              <span className="text-gradient text-3xl font-semibold">{index + 1}</span>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.text}</p>
              {step.href && (
                <Link
                  href={step.href}
                  className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm text-glow hover:underline"
                >
                  {step.cta} <ArrowRight className="size-3.5" />
                </Link>
              )}
            </Spotlight>
          ))}
        </ol>
      </RevealItem>
    </RevealGroup>
  );
}
