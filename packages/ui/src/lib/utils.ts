import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes condicionais (clsx) e resolve conflitos de classes do
 * Tailwind (tailwind-merge). Utilitário padrão exigido pelo shadcn/ui —
 * usado por todo componente gerado pelo CLI.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
