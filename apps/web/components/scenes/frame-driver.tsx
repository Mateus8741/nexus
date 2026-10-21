"use client";

import { useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useState } from "react";

/** true enquanto o elemento está (quase) na viewport e a aba está visível. */
export function useSceneVisible(ref: RefObject<Element | null>, margin = "100px"): boolean {
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setInView(Boolean(entries[0]?.isIntersecting)),
      {
        rootMargin: margin,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin]);

  useEffect(() => {
    const onChange = () => setTabVisible(!document.hidden);
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return inView && tabVisible;
}

/**
 * Renderiza sob demanda a no máximo `fps` quadros por segundo (use com
 * `frameloop="demand"` no Canvas). Parado quando `active` é falso.
 */
export function FrameDriver({ active, fps = 30 }: { active: boolean; fps?: number }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!active) return;
    const interval = 1000 / fps;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < interval) return;
      last = now;
      invalidate();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, fps, invalidate]);

  return null;
}
