"use client";

import { cn } from "@nexus/ui/lib/utils";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** Cabeçalho padrão das seções da landing. */
export function SectionHead({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  readonly eyebrow: string;
  readonly title: ReactNode;
  readonly subtitle?: string;
  readonly align?: "center" | "left";
}) {
  return (
    <div className={cn("flex flex-col gap-4", align === "center" && "items-center text-center")}>
      <Rise>
        <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium tracking-wide text-glow uppercase">
          <span className="size-1.5 rounded-full bg-glow shadow-[0_0_10px_var(--glow)]" />
          {eyebrow}
        </span>
      </Rise>
      <Rise delay={0.08}>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {title}
        </h2>
      </Rise>
      {subtitle && (
        <Rise delay={0.16}>
          <p className="max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
            {subtitle}
          </p>
        </Rise>
      )}
    </div>
  );
}

/** Entrada com fade + subida + blur quando entra na viewport. */
export function Rise({
  children,
  delay = 0,
  className,
}: {
  readonly children: ReactNode;
  readonly delay?: number;
  readonly className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ type: "spring", stiffness: 140, damping: 22, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Card de vidro com tilt 3D e halo que seguem o cursor (variáveis CSS
 * --mx/--my alimentam a classe `spotlight`). Sem tilt com reduced-motion.
 */
export function TiltCard({
  children,
  className,
  delay = 0,
  max = 5,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly delay?: number;
  readonly max?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <Rise delay={delay} className={cn("[perspective:900px]", className)}>
      <div
        ref={ref}
        className="glass spotlight h-full rounded-3xl transition-transform duration-200 ease-out will-change-transform"
        onPointerMove={(event) => {
          const el = ref.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          el.style.setProperty("--mx", `${x}px`);
          el.style.setProperty("--my", `${y}px`);
          if (reduce || event.pointerType === "touch") return;
          const rx = (0.5 - y / rect.height) * max * 2;
          const ry = (x / rect.width - 0.5) * max * 2;
          el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        }}
        onPointerLeave={() => {
          if (ref.current) ref.current.style.transform = "";
        }}
      >
        {children}
      </div>
    </Rise>
  );
}

/** Número que conta de 0 até `value` quando entra na viewport. */
export function Counter({
  value,
  suffix = "",
  prefix = "",
  className,
}: {
  readonly value: number;
  readonly suffix?: string;
  readonly prefix?: string;
  readonly className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => `${prefix}${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(mv, value, { duration: 1.8, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, reduce, mv, value]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

/** Índice que avança a cada `ms` enquanto o elemento está visível. */
export function useTicker(count: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!visible || reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ms);
    return () => clearInterval(id);
  }, [visible, reduce, count, ms]);

  return { ref, index };
}
