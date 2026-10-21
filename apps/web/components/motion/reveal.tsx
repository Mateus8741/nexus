"use client";

import { type HTMLMotionProps, motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 260, damping: 26 },
  },
};

/** Container que faz os <RevealItem> filhos entrarem em cascata. */
export function RevealGroup({
  children,
  ...props
}: HTMLMotionProps<"div"> & { children: ReactNode }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" {...props}>
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  ...props
}: HTMLMotionProps<"div"> & { children: ReactNode }) {
  return (
    <motion.div variants={itemVariants} {...props}>
      {children}
    </motion.div>
  );
}

/** Entrada simples (sem container pai) — atraso opcional em segundos. */
export function FadeUp({
  children,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 26, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
