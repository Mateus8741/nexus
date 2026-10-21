"use client";

import { cn } from "@nexus/ui/lib/utils";
import { Download, Gauge, UserPlus } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, useState } from "react";

import { Rise, SectionHead } from "./shared";

const STEPS = [
  {
    icon: UserPlus,
    title: "Crie a conta",
    text: "Cadastre-se em menos de um minuto e crie seu primeiro ambiente. É onde ficam seus dispositivos, cenas e permissões.",
    tag: "1 minuto",
  },
  {
    icon: Download,
    title: "Instale o app e o agente",
    text: "Baixe o widget para Windows ou macOS e, nos computadores que quiser controlar, instale o agente. Conecte a Tuya e outras integrações.",
    tag: "Windows e macOS",
  },
  {
    icon: Gauge,
    title: "Controle tudo",
    text: "Acenda luzes, ajuste o clima, bloqueie PCs e ative cenas pelo painel web ou pelo widget, com cada ação registrada.",
    tag: "Web e desktop",
  },
] as const;

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  const scaleY = useTransform(reduce ? scrollYProgress : smooth, [0, 1], [0, 1]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(v < 0.28 ? 0 : v < 0.66 ? 1 : 2);
  });

  return (
    <section id="como-funciona" className="relative scroll-mt-20 px-5 py-24 sm:py-32">
      <div className="mx-auto flex max-w-4xl flex-col gap-16">
        <SectionHead
          eyebrow="Como funciona"
          title={
            <>
              Do zero ao controle total em <span className="text-gradient">três passos</span>
            </>
          }
          subtitle="Sem obra, sem cabos novos: o Nexus conversa com o que você já tem."
        />

        <div ref={ref} className="relative flex flex-col gap-10 sm:gap-16">
          <div
            className="absolute top-6 bottom-6 left-6 w-px bg-white/10 sm:left-1/2"
            aria-hidden="true"
          />
          <motion.div
            className="absolute top-6 bottom-6 left-6 w-px origin-top bg-gradient-to-b from-glow via-glow-2 to-glow shadow-[0_0_18px_2px_var(--glow)] sm:left-1/2"
            style={{ scaleY }}
            aria-hidden="true"
          />

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const on = i <= active;
            const right = i % 2 === 1;
            return (
              <div
                key={step.title}
                className={cn(
                  "relative grid grid-cols-[3rem_1fr] items-start gap-5 sm:grid-cols-2 sm:gap-20",
                )}
              >
                <motion.div
                  animate={{ scale: i === active ? 1.15 : 1 }}
                  className={cn(
                    "relative z-10 flex size-12 items-center justify-center rounded-2xl border bg-background transition-colors duration-500 sm:absolute sm:left-1/2 sm:-translate-x-1/2",
                    on
                      ? "glow-ring border-glow/60 text-glow"
                      : "border-white/10 text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </motion.div>
                <div className={cn("sm:col-start-1", right && "sm:col-start-2")}>
                  <Rise>
                    <div
                      className={cn(
                        "glass rounded-3xl p-6 transition-opacity duration-500",
                        on ? "opacity-100" : "opacity-55",
                      )}
                    >
                      <span className="text-xs font-medium tracking-widest text-glow uppercase">
                        Passo {i + 1} · {step.tag}
                      </span>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h3>
                      <p className="mt-2 text-sm text-pretty text-muted-foreground">{step.text}</p>
                    </div>
                  </Rise>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
