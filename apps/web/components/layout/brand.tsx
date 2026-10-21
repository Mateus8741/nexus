"use client";

import { motion } from "motion/react";
import Link from "next/link";

/** Logo animado: o "N" respira com um halo pulsante. */
export function Brand({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="relative flex size-8 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-xl bg-glow/40 blur-md transition-opacity group-hover:opacity-100" />
        <motion.span
          whileHover={{ rotate: 8, scale: 1.08 }}
          className="relative flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-glow to-glow-2 text-sm font-bold text-background shadow-lg"
        >
          N
        </motion.span>
      </span>
      {!compact && <span className="text-gradient text-lg">Nexus</span>}
    </Link>
  );
}
