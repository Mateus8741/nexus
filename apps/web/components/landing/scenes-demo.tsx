"use client";

import { cn } from "@nexus/ui/lib/utils";
import {
  AirVent,
  DoorOpen,
  Film,
  Lamp,
  Lightbulb,
  Monitor,
  Moon,
  Sofa,
  Sun,
  Tv,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { getScene, SCENES, type SceneId } from "@/lib/devices/scenes";
import { Rise, SectionHead } from "./shared";

const IsoRoom = dynamic(() => import("@/components/scenes/iso-room").then((m) => m.IsoRoom), {
  ssr: false,
  loading: () => <div className="aspect-[552/430] w-full" />,
});

const ICON: Record<SceneId, typeof Sun> = {
  bright: Sun,
  cozy: Sofa,
  movie: Film,
  night: Moon,
  away: DoorOpen,
};

interface DemoState {
  readonly lights: number;
  readonly tv: boolean;
  readonly lamp: boolean;
  readonly ac: number | null;
  readonly pc: "online" | "bloqueado";
}

const STATE: Record<SceneId, DemoState> = {
  bright: { lights: 4, tv: true, lamp: true, ac: null, pc: "online" },
  cozy: { lights: 4, tv: false, lamp: true, ac: 23, pc: "online" },
  movie: { lights: 0, tv: true, lamp: false, ac: 22, pc: "online" },
  night: { lights: 0, tv: false, lamp: false, ac: null, pc: "online" },
  away: { lights: 0, tv: false, lamp: false, ac: null, pc: "bloqueado" },
};

function DeviceCard({
  icon: Icon,
  name,
  status,
  on,
}: {
  readonly icon: typeof Sun;
  readonly name: string;
  readonly status: string;
  readonly on: boolean;
}) {
  return (
    <motion.div
      layout
      className={cn(
        "glass flex items-center gap-3 rounded-2xl p-3.5 transition-shadow duration-500",
        on && "glow-ring",
      )}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-xl transition-colors duration-500",
          on ? "bg-warning/20 text-warning" : "bg-white/5 text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{status}</p>
      </div>
      <span
        className={cn(
          "size-2.5 rounded-full transition-all duration-500",
          on ? "bg-warning shadow-[0_0_12px_var(--warning)]" : "bg-white/15",
        )}
      />
    </motion.div>
  );
}

export function ScenesDemo() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  // O canvas só existe enquanto a seção está perto da viewport.
  const near = useInView(wrapRef, { margin: "300px 0px 300px 0px" });
  const visible = useInView(wrapRef, { margin: "-15% 0px -15% 0px" });
  const [scene, setScene] = useState<SceneId>("cozy");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || !visible || reduce) return;
    const id = setInterval(() => {
      setScene((current) => {
        const i = SCENES.findIndex((s) => s.id === current);
        return getScene(SCENES[(i + 1) % SCENES.length]?.id ?? "bright").id;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [auto, visible, reduce]);

  const def = getScene(scene);
  const st = STATE[scene];

  return (
    <section id="cenas" className="relative scroll-mt-20 overflow-hidden px-5 py-24 sm:py-32">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <SectionHead
          eyebrow="Demonstração"
          title={
            <>
              Um toque, <span className="text-gradient">o ambiente inteiro</span> muda
            </>
          }
          subtitle="Experimente: escolha uma cena e veja luzes, clima e dispositivos reagirem na hora."
        />

        <Rise>
          {/* biome-ignore lint/a11y/useSemanticElements: grade de botões */}
          <div role="group" aria-label="Cenas" className="flex flex-wrap justify-center gap-2.5">
            {SCENES.map((s) => {
              const Icon = ICON[s.id];
              const isActive = s.id === scene;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setAuto(false);
                    setScene(s.id);
                  }}
                  className={cn(
                    "glass relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="demo-halo"
                      className="glow-ring absolute inset-0 rounded-full bg-gradient-to-b from-glow/25 to-transparent"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="relative size-4" />
                  <span className="relative">{s.label}</span>
                </button>
              );
            })}
          </div>
        </Rise>

        <div ref={wrapRef} className="grid items-center gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div className="relative">
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-8 -z-10 rounded-full blur-3xl"
              animate={{ backgroundColor: def.tint, opacity: 0.18 + def.ambient * 0.12 }}
              transition={{ duration: 0.8 }}
            />
            {near ? (
              <IsoRoom
                lightsOn={st.lights}
                lightsTotal={4}
                computersOnline={st.pc === "online" ? 1 : 0}
                acOn={st.ac !== null}
                tint={def.tint}
                ambient={def.ambient}
              />
            ) : (
              <div className="aspect-[552/430] w-full" />
            )}
          </div>

          <div className="flex flex-col gap-3">
            <motion.p
              key={def.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-1 text-sm text-muted-foreground"
            >
              <span className="font-semibold text-foreground">{def.label}:</span> {def.description}
            </motion.p>
            <DeviceCard
              icon={Lightbulb}
              name="Luzes da sala"
              status={st.lights ? `${st.lights} de 4 ligadas` : "Apagadas"}
              on={st.lights > 0}
            />
            <DeviceCard
              icon={AirVent}
              name="Ar-condicionado"
              status={st.ac ? `Ligado · ${st.ac}°C` : "Desligado"}
              on={st.ac !== null}
            />
            <DeviceCard
              icon={Tv}
              name="TV e backlight"
              status={st.tv ? "Ligada" : "Desligada"}
              on={st.tv}
            />
            <DeviceCard
              icon={Lamp}
              name="Abajur"
              status={st.lamp ? "Ligado" : "Desligado"}
              on={st.lamp}
            />
            <DeviceCard
              icon={Monitor}
              name="estudio-pc"
              status={st.pc === "online" ? "Online" : "Bloqueado"}
              on={st.pc === "online"}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
