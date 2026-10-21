"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";

import { Rise } from "./shared";

export function FinalCta() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 80, reduce ? 0 : -80]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1.05, 0.9]);

  return (
    <section ref={ref} className="relative overflow-hidden px-5 py-28 sm:py-40">
      <motion.div
        aria-hidden="true"
        style={{ y, scale }}
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[min(90vw,52rem)] -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          className="size-full rounded-full opacity-50 blur-3xl [background:conic-gradient(from_0deg,var(--glow),var(--glow-2),#ffbf73,var(--glow))]"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 40, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
      </motion.div>
      <div className="grid-bg absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <Rise>
          <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Sua casa e seus PCs, <span className="text-gradient">sob um só comando</span>
          </h2>
        </Rise>
        <Rise delay={0.1}>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            Crie sua conta, instale o app e comece a controlar todos os ambientes agora mesmo.
          </p>
        </Rise>
        <Rise delay={0.2}>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/cadastro"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-glow to-glow-2 px-8 py-4 text-base font-semibold text-background shadow-[0_10px_50px_-10px_var(--glow)] transition-transform hover:scale-105 active:scale-95"
            >
              Criar conta grátis
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="glass inline-flex items-center rounded-full px-8 py-4 text-base font-semibold transition-transform hover:scale-105 active:scale-95"
            >
              Entrar
            </Link>
          </div>
        </Rise>
      </div>
    </section>
  );
}
