"use client";

import { cn } from "@nexus/ui/lib/utils";
import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

import { Spotlight } from "@/components/motion/spotlight";

export const fieldClass =
  "h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm outline-none transition-[border-color,box-shadow,background] placeholder:text-muted-foreground/70 focus:border-glow/60 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--glow)_22%,transparent)]";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: o controle é o filho (input/select) passado por quem usa
    <label
      className={cn(
        "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {label}
      {children}
    </label>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function SelectInput({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClass, "appearance-none pr-8", className)} {...props} />;
}

interface ButtonProps extends Omit<ComponentProps<typeof motion.button>, "children"> {
  readonly children: ReactNode;
  readonly variant?: "primary" | "ghost" | "danger";
}

const variants = {
  primary:
    "bg-gradient-to-r from-glow to-glow-2 text-background shadow-[0_8px_24px_-8px_var(--glow)] hover:brightness-110",
  ghost: "border border-white/10 bg-white/[0.04] hover:bg-white/10",
  danger: "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
} as const;

export function ActionButton({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none transition-[filter,background] focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-gradient text-3xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <Spotlight className={cn("p-5", className)}>{children}</Spotlight>;
}
