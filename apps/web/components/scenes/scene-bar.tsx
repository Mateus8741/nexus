"use client";

import { cn } from "@nexus/ui/lib/utils";
import { DoorOpen, Film, Moon, Sofa, Sun } from "lucide-react";
import { motion } from "motion/react";

import { SCENES, type SceneId } from "@/lib/devices/scenes";

const SCENE_ICON: Record<SceneId, typeof Sun> = {
  bright: Sun,
  cozy: Sofa,
  movie: Film,
  night: Moon,
  away: DoorOpen,
};

interface SceneBarProps {
  readonly active: SceneId | null;
  readonly busy: boolean;
  readonly onSelect: (id: SceneId) => void;
}

/** Linha de cenas — a ativa brilha e o halo desliza entre elas. */
export function SceneBar({ active, busy, onSelect }: SceneBarProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: grade de botões, fieldset quebraria o layout
    <div role="group" aria-label="Cenas" className="grid grid-cols-5 gap-2 sm:gap-3">
      {SCENES.map((scene) => {
        const Icon = SCENE_ICON[scene.id];
        const isActive = active === scene.id;
        return (
          <motion.button
            key={scene.id}
            type="button"
            disabled={busy}
            aria-pressed={isActive}
            title={scene.description}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => onSelect(scene.id)}
            className={cn(
              "glass relative flex flex-col items-center gap-2 rounded-2xl px-1 py-3.5 text-[0.68rem] font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait sm:text-[0.8rem]",
              isActive && "text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="scene-halo"
                className="glow-ring absolute inset-0 rounded-2xl bg-gradient-to-b from-glow/25 to-transparent"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <motion.span
              className="relative"
              animate={
                isActive ? { scale: [1, 1.25, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }
              }
              transition={{ duration: 0.5 }}
            >
              <Icon className="size-5" />
            </motion.span>
            <span className="relative">{scene.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
