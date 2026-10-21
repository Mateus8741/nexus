"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Atualização ao vivo leve: refaz os Server Components a cada `intervalMs` com a aba visível. */
export function LiveRefresh({
  intervalMs = 10_000,
  enabled = true,
}: {
  intervalMs?: number;
  enabled?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs, enabled]);

  return null;
}
