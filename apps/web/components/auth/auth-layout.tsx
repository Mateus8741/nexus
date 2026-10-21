"use client";

import { motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

import { Brand } from "@/components/layout/brand";
import { IsoRoom } from "@/components/scenes/iso-room";

/** Layout das telas de entrada: ilustração viva à esquerda, formulário de vidro à direita. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const [lights, setLights] = useState(0);

  // As luzes da ilustração acendem e apagam sozinhas, em ciclo.
  useEffect(() => {
    const timer = setInterval(() => setLights((value) => (value + 1) % 5), 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="grid-bg absolute inset-0 -z-10" aria-hidden="true" />
        <Brand />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <IsoRoom lightsOn={lights} lightsTotal={4} computersOnline={1} acOn={lights % 2 === 0} />
        </motion.div>
        <p className="max-w-md text-sm text-muted-foreground">
          Um sistema operacional para o mundo físico — luzes, clima e computadores de qualquer
          ambiente, sob o seu controle.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="glass glow-ring w-full max-w-md rounded-3xl p-8"
        >
          <div className="mb-6 lg:hidden">
            <Brand />
          </div>
          <h1 className="text-gradient text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 mb-7 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </motion.div>
      </section>
    </main>
  );
}
