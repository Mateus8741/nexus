import { cookies } from "next/headers";

export const DEMO_COOKIE = "nexus-demo";

/**
 * Modo demonstração: dados fictícios no lugar do plugin-host. Liga com
 * NEXT_PUBLIC_NEXUS_DEMO=1 ou visitando qualquer página com `?demo=1`
 * (o middleware grava o cookie; `?demo=0` desliga).
 */
export async function isDemoMode(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_NEXUS_DEMO === "1") return true;
  const store = await cookies();
  return store.get(DEMO_COOKIE)?.value === "1";
}
