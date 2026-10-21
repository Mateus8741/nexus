"use client";

import { cn } from "@nexus/ui/lib/utils";
import {
  CalendarClock,
  Cpu,
  Lightbulb,
  Lock,
  Monitor,
  Plug,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Workflow,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { SectionHead, TiltCard, useTicker } from "./shared";

function CardShell({
  icon,
  title,
  text,
  children,
  className,
  delay,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly text: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly delay?: number;
}) {
  return (
    <TiltCard className={className} delay={delay}>
      <div className="flex h-full flex-col gap-5 p-6">
        <div className="relative flex min-h-36 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-black/20 p-4">
          {children}
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="text-glow">{icon}</span>
            {title}
          </h3>
          <p className="text-sm text-pretty text-muted-foreground">{text}</p>
        </div>
      </div>
    </TiltCard>
  );
}

/* ----------------------------------------------------------- mini-visuais */

function LightsVisual() {
  const { ref, index } = useTicker(6, 900);
  return (
    <div ref={ref} className="flex items-end gap-4 sm:gap-7">
      {[0, 1, 2, 3, 4].map((i) => {
        const on = (index + i) % 3 !== 0;
        return (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-6 w-px bg-white/15" />
            <motion.div
              animate={{
                backgroundColor: on ? "#ffbf73" : "#2b2f45",
                boxShadow: on ? "0 0 36px 8px rgba(255,191,115,0.45)" : "0 0 0 0 rgba(0,0,0,0)",
              }}
              transition={{ duration: 0.5 }}
              className="size-8 rounded-full sm:size-10"
            />
            <span className="text-[0.65rem] text-muted-foreground">
              {on ? "ligada" : "apagada"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ClimateVisual() {
  const { ref, index } = useTicker(5, 1100);
  const temps = [24, 23, 22, 22, 23];
  return (
    <div ref={ref} className="relative flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 100" className="size-28" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="rgb(255 255 255 / 0.08)"
          strokeWidth="6"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--glow)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="264"
          animate={{ strokeDashoffset: 264 - ((temps[index] ?? 22) - 16) * 22 }}
          transition={{ duration: 0.8 }}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Thermometer className="size-4 text-glow" />
        <span className="text-2xl font-semibold tabular-nums">{temps[index]}°</span>
      </div>
    </div>
  );
}

function ComputersVisual() {
  const { ref, index } = useTicker(4, 800);
  const bars = [0.5, 0.8, 0.35, 0.65];
  return (
    <div ref={ref} className="flex w-full max-w-48 flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Monitor className="size-3.5 text-glow" /> estudio-pc
        </span>
        <span className="flex items-center gap-1 text-success">
          <span className="size-1.5 rounded-full bg-success" /> online
        </span>
      </div>
      <div className="flex h-16 items-end gap-2">
        {bars.map((b, i) => (
          <motion.div
            // biome-ignore lint/suspicious/noArrayIndexKey: barras estáticas
            key={i}
            animate={{ height: `${Math.min(100, (b + ((index + i) % 4) * 0.12) * 100)}%` }}
            transition={{ duration: 0.7 }}
            className="flex-1 rounded-md bg-gradient-to-t from-glow/20 to-glow"
          />
        ))}
      </div>
      <div className="flex gap-2">
        <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/5 py-1 text-[0.65rem]">
          <Lock className="size-3" /> Bloquear
        </span>
        <span className="flex flex-1 items-center justify-center rounded-lg bg-white/5 py-1 text-[0.65rem]">
          Suspender
        </span>
      </div>
    </div>
  );
}

const SCENE_CHIPS = ["Claro", "Aconchego", "Cinema", "Noite", "Fora"];

function ScenesVisual() {
  const { ref, index } = useTicker(SCENE_CHIPS.length, 1200);
  return (
    <div ref={ref} className="flex flex-wrap items-center justify-center gap-2.5">
      {SCENE_CHIPS.map((name, i) => (
        <motion.span
          key={name}
          animate={{ scale: i === index ? 1.1 : 1, y: i === index ? -3 : 0 }}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors duration-500",
            i === index
              ? "glow-ring border-glow/50 bg-glow/15 text-foreground"
              : "border-white/10 text-muted-foreground",
          )}
        >
          {name}
        </motion.span>
      ))}
    </div>
  );
}

function AutomationVisual() {
  return (
    <div className="relative flex w-full max-w-md items-center justify-between gap-2">
      <div className="absolute inset-x-8 top-1/2 h-px bg-white/10" />
      <motion.span
        className="absolute top-1/2 left-8 size-2 -translate-y-1/2 rounded-full bg-glow shadow-[0_0_14px_var(--glow)]"
        animate={{ left: ["8%", "88%"], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      {[
        { icon: CalendarClock, label: "Às 19h" },
        { icon: Workflow, label: "Se escurecer" },
        { icon: Sparkles, label: "Cena Aconchego" },
      ].map(({ icon: Icon, label }) => (
        <div key={label} className="relative z-10 flex flex-col items-center gap-2">
          <span className="glass flex size-12 items-center justify-center rounded-2xl">
            <Icon className="size-5 text-glow" />
          </span>
          <span className="text-[0.7rem] text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

function WidgetVisual() {
  const { ref, index } = useTicker(3, 1000);
  return (
    <div ref={ref} className="glass flex w-44 flex-col gap-2 rounded-2xl p-3">
      <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
        <span className="font-medium text-foreground">Nexus</span>
        <span>menu bar</span>
      </div>
      {["Sala", "Escritório", "Quarto"].map((name, i) => (
        <div key={name} className="flex items-center justify-between text-xs">
          {name}
          <span
            className={cn(
              "flex h-4 w-7 items-center rounded-full p-0.5 transition-colors duration-500",
              index === i ? "justify-end bg-glow" : "justify-start bg-white/15",
            )}
          >
            <motion.span layout className="size-3 rounded-full bg-white" />
          </span>
        </div>
      ))}
    </div>
  );
}

function RolesVisual() {
  const { ref, index } = useTicker(4, 1000);
  const rows = ["Ligar e desligar", "Editar cenas", "Bloquear PCs", "Gerenciar API keys"];
  return (
    <div ref={ref} className="flex w-full max-w-48 flex-col gap-2">
      {rows.map((row, i) => {
        const allowed = (i + index) % 4 !== 3;
        return (
          <div key={row} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate">{row}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.6rem] transition-colors duration-500",
                allowed ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive",
              )}
            >
              {allowed ? "permitido" : "negado"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const LOGS = [
  ["Ana", "ligou Luz da sala"],
  ["Bia", "ativou cena Cinema"],
  ["Agente", "bloqueou estudio-pc"],
  ["Léo", "criou API key"],
  ["Ana", "desligou AC do quarto"],
  ["Bia", "revogou acesso"],
];

function AuditVisual() {
  const { ref, index } = useTicker(LOGS.length, 1300);
  const visible = [0, 1, 2].map((k) => LOGS[(index + k) % LOGS.length] as string[]);
  return (
    <div ref={ref} className="flex w-full max-w-52 flex-col gap-1.5 font-mono text-[0.68rem]">
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map(([who, what], k) => (
          <motion.div
            key={`${who}-${what}`}
            layout
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1 - k * 0.3, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="rounded-md bg-white/5 px-2 py-1"
          >
            <span className="text-glow">{who}</span> {what}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function PluginsVisual() {
  const icons = [Plug, Cpu, Lightbulb, Thermometer];
  return (
    <div className="relative flex size-32 items-center justify-center">
      <span className="glass z-10 flex size-12 items-center justify-center rounded-2xl text-sm font-bold text-glow">
        N
      </span>
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
      >
        <div className="absolute inset-2 rounded-full border border-dashed border-white/15" />
        {icons.map((Icon, i) => {
          const angle = (i / icons.length) * Math.PI * 2;
          return (
            <motion.span
              key={Icon.displayName ?? i}
              className="glass absolute flex size-8 items-center justify-center rounded-xl"
              style={{
                left: `calc(50% + ${Math.cos(angle) * 50}px - 16px)`,
                top: `calc(50% + ${Math.sin(angle) * 50}px - 16px)`,
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 24, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            >
              <Icon className="size-4 text-glow-2" />
            </motion.span>
          );
        })}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ seção */

export function Features() {
  return (
    <section id="recursos" className="relative scroll-mt-20 px-5 py-24 sm:py-32">
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHead
          eyebrow="Recursos"
          title={
            <>
              Tudo o que acende, esfria e liga, <span className="text-gradient">num só lugar</span>
            </>
          }
          subtitle="Do interruptor ao servidor: controle luzes, tomadas, clima e computadores de todos os ambientes, com segurança e histórico."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CardShell
            className="lg:col-span-2"
            icon={<Lightbulb className="size-5" />}
            title="Luzes e tomadas"
            text="Ligue, apague e ajuste brilho e cor de qualquer dispositivo, em tempo real, de qualquer lugar."
          >
            <LightsVisual />
          </CardShell>
          <CardShell
            delay={0.08}
            icon={<Thermometer className="size-5" />}
            title="Clima"
            text="Ar-condicionado na temperatura certa antes de você chegar."
          >
            <ClimateVisual />
          </CardShell>
          <CardShell
            icon={<Cpu className="size-5" />}
            title="Computadores"
            text="Agentes nos PCs mostram status e executam bloqueio e suspensão."
          >
            <ComputersVisual />
          </CardShell>
          <CardShell
            delay={0.08}
            className="lg:col-span-2"
            icon={<Sparkles className="size-5" />}
            title="Cenas"
            text="Claro, Aconchego, Cinema, Noite e Fora: um toque reconfigura o ambiente inteiro."
          >
            <ScenesVisual />
          </CardShell>
          <CardShell
            className="lg:col-span-2"
            icon={<Workflow className="size-5" />}
            title="Automações"
            text="Gatilhos por horário e condições que acionam cenas e ações sem você tocar em nada."
          >
            <AutomationVisual />
          </CardShell>
          <CardShell
            delay={0.08}
            icon={<Monitor className="size-5" />}
            title="Widget desktop"
            text="Controle rápido pela barra de menu (macOS) ou bandeja (Windows)."
          >
            <WidgetVisual />
          </CardShell>
          <CardShell
            icon={<ShieldCheck className="size-5" />}
            title="Papéis e permissões"
            text="Defina quem pode o quê, ação por ação, por ambiente."
          >
            <RolesVisual />
          </CardShell>
          <CardShell
            delay={0.08}
            icon={<ScrollText className="size-5" />}
            title="Auditoria"
            text="Cada comando fica registrado: quem fez, quando e onde."
          >
            <AuditVisual />
          </CardShell>
          <CardShell
            delay={0.16}
            icon={<Plug className="size-5" />}
            title="Plugins e integrações"
            text="Tuya e muito mais, além de API keys para conectar o que você quiser."
          >
            <PluginsVisual />
          </CardShell>
        </div>
      </div>
    </section>
  );
}
