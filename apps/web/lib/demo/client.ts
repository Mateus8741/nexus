/** Versão browser de isDemoMode — usada pelo apiFetch das telas administrativas. */
export function isDemoClient(): boolean {
  if (process.env.NEXT_PUBLIC_NEXUS_DEMO === "1") return true;
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").includes("nexus-demo=1");
}
