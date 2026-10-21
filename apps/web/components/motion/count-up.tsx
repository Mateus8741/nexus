"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

interface CountUpProps {
  readonly value: number;
  readonly className?: string;
  readonly suffix?: string;
}

/** Número que "rola" até o valor novo sempre que ele muda. */
export function CountUp({ value, className, suffix = "" }: CountUpProps) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => `${Math.round(latest)}${suffix}`);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [motionValue, value]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
