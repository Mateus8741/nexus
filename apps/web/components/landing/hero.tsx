"use client";

import { ArrowRight, ChevronDown, Download, Monitor, Plug } from "lucide-react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import HeroArt from "./hero-art";

const TITLE_LINES = [
  ["Toda", "a", "sua"],
  ["casa", "e", "escritório,"],
  ["num", "só", "lugar."],
] as const;
const GRADIENT_LINE = 2;
const SPOT = 1040;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const word = {
  hidden: { opacity: 0, y: "0.7em", rotateX: -50 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
  },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
};

export function Hero({ signedIn = false }: { signedIn?: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);

  // pausa as animações fora da viewport ou com a aba oculta
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let intersecting = true;
    let tabVisible = !document.hidden;
    const sync = () => setVisible(intersecting && tabVisible);
    const io = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? true;
      sync();
    });
    io.observe(el);
    const onVis = () => {
      tabVisible = !document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // brilho que segue o cursor (só transform; desligado em toque)
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 80, damping: 20 });
  const sy = useSpring(my, { stiffness: 80, damping: 20 });

  useEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.jump(r.width * 0.5 - SPOT / 2);
    my.jump(r.height * 0.4 - SPOT / 2);
  }, [mx, my]);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 90]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -60]);

  const show = reduced ? "show" : "show";
  const initial = reduced ? "show" : "hidden";

  return (
    <section
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || reduced) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left - SPOT / 2);
        my.set(e.clientY - r.top - SPOT / 2);
      }}
      className="relative isolate flex min-h-svh items-center overflow-hidden pb-16 pt-28"
    >
      {/* fundo: aurora, spot, grade em perspectiva */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <motion.div
          className="absolute left-0 top-0 [@media(pointer:coarse)]:hidden"
          style={{
            x: sx,
            y: sy,
            width: SPOT,
            height: SPOT,
            backgroundImage:
              "radial-gradient(closest-side, color-mix(in oklch, var(--glow) 22%, transparent), transparent)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[55%] [mask-image:linear-gradient(to_top,black,transparent)]"
          style={{ perspective: "500px" }}
        >
          <div
            className="absolute inset-x-[-50%] bottom-0 h-[200%] origin-bottom opacity-40"
            style={{
              transform: "rotateX(62deg)",
              backgroundImage:
                "linear-gradient(to right, color-mix(in oklch, var(--glow) 45%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--glow) 45%, transparent) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* cena em SVG leve */}
      <motion.div
        style={{ y: sceneY }}
        className="pointer-events-none absolute inset-0 -z-[5]"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-0 opacity-40 lg:opacity-100">
          <HeroArt active={visible} reducedMotion={reduced} />
        </div>
      </motion.div>

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative mx-auto w-full max-w-7xl px-5 sm:px-8"
      >
        <motion.div variants={container} initial={initial} animate={show} className="max-w-2xl">
          <motion.div
            variants={fadeUp}
            className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-300/70" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-300" />
            </span>
            Luzes, tomadas, clima e PCs. Tudo conectado.
          </motion.div>

          <h1 className="text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl [perspective:800px]">
            {TITLE_LINES.map((line, li) => (
              <span key={line.join("-")} className="block">
                {line.map((w) => (
                  <span
                    key={w}
                    className="mr-[0.25em] inline-block overflow-visible pb-[0.08em] align-top"
                  >
                    <motion.span
                      variants={word}
                      className={`inline-block ${li === GRADIENT_LINE ? "text-gradient" : ""}`}
                    >
                      {w}
                    </motion.span>
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            O Nexus reúne dashboard web, app para Windows e macOS, automações, plugins como Tuya e
            agentes nos seus computadores, com papéis, permissões e auditoria de tudo que acontece.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={signedIn ? "/dashboard" : "/cadastro"}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-glow to-glow-2 px-6 py-3 text-sm font-semibold text-background shadow-lg shadow-glow/30 transition hover:shadow-glow/50"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">{signedIn ? "Abrir painel" : "Criar conta grátis"}</span>
              <ArrowRight className="relative size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/downloads"
              className="glass inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:bg-white/10"
            >
              <Download className="size-4" />
              Baixar o app
            </Link>
          </motion.div>

          <motion.ul
            variants={fadeUp}
            className="mt-8 flex flex-wrap gap-2.5 text-xs text-muted-foreground"
          >
            <li className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <Monitor className="size-3.5 text-glow" />
              Windows e macOS
            </li>
            <li className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <Plug className="size-3.5 text-amber-300" />
              Tuya e mais integrações
            </li>
          </motion.ul>
        </motion.div>
      </motion.div>

      <a
        href="#recursos"
        aria-label="Rolar para os recursos"
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground/70 transition hover:text-foreground"
      >
        Role
        <motion.span
          animate={reduced ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </a>
    </section>
  );
}
