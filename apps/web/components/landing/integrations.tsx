"use client";

import {
  Apple,
  Cloud,
  Cpu,
  KeyRound,
  MonitorSmartphone,
  Plug,
  Terminal,
  Webhook,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Counter, Rise, SectionHead } from "./shared";

const ROW_A = [
  { icon: Cloud, label: "Tuya" },
  { icon: MonitorSmartphone, label: "Windows" },
  { icon: Apple, label: "macOS" },
  { icon: KeyRound, label: "API Keys" },
  { icon: Cpu, label: "Agentes de PC" },
  { icon: Plug, label: "Plugins" },
  { icon: Webhook, label: "Webhooks" },
  { icon: Terminal, label: "API REST" },
];
const ROW_B = [...ROW_A.slice(4), ...ROW_A.slice(0, 4)];

function Marquee({
  items,
  reverse = false,
}: {
  readonly items: typeof ROW_A;
  readonly reverse?: boolean;
}) {
  const reduce = useReducedMotion();
  const loop = [...items, ...items];
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <motion.div
        className="flex w-max gap-4"
        animate={reduce ? undefined : { x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: 36, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
      >
        {loop.map(({ icon: Icon, label }, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: lista duplicada para o loop
            key={`${label}-${i}`}
            aria-hidden={i >= items.length}
            className="glass flex items-center gap-3 rounded-2xl px-6 py-4"
          >
            <Icon className="size-5 text-glow" />
            <span className="text-base font-medium whitespace-nowrap">{label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

const STATS = [
  { value: 5, suffix: "", label: "cenas prontas" },
  { value: 3, suffix: "", label: "instaladores" },
  { value: 100, suffix: "%", label: "das ações auditadas" },
  { value: 4, suffix: "", label: "tipos de dispositivo" },
];

export function Integrations() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-5">
        <SectionHead
          eyebrow="Integrações"
          title={
            <>
              Conversa com o que você <span className="text-gradient">já usa</span>
            </>
          }
          subtitle="Dispositivos Tuya, computadores Windows e macOS e uma API aberta para estender o que faltar."
        />
      </div>
      <Rise className="mt-12 flex flex-col gap-4">
        <Marquee items={ROW_A} />
        <Marquee items={ROW_B} reverse />
      </Rise>
      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-4 px-5 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Rise key={s.label} delay={i * 0.07}>
            <div className="glass rounded-3xl p-6 text-center">
              <Counter
                value={s.value}
                suffix={s.suffix}
                className="text-gradient text-4xl font-semibold tabular-nums sm:text-5xl"
              />
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </div>
          </Rise>
        ))}
      </div>
    </section>
  );
}
