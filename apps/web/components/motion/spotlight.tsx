"use client";

import { cn } from "@nexus/ui/lib/utils";
import { type HTMLMotionProps, motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Card de vidro com halo que segue o mouse (CSS `spotlight` em
 * @nexus/ui/globals.css lê --mx/--my). Aceita props de motion (layout,
 * whileHover, variants...).
 */
export function Spotlight({
  children,
  className,
  onMouseMove,
  ...props
}: HTMLMotionProps<"div"> & { children: ReactNode }) {
  return (
    <motion.div
      className={cn("glass spotlight rounded-2xl", className)}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
        onMouseMove?.(event);
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
