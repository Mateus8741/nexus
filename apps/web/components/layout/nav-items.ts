import type { LucideIcon } from "lucide-react";
import { Activity, Cpu, Layers, LayoutDashboard, Puzzle, Settings, Workflow } from "lucide-react";

/**
 * Configuração estática da navegação do shell. Só "Dashboard" aponta para uma
 * rota real (app/page.tsx); o restante existe apenas para mostrar a forma do
 * sistema de navegação — nenhuma dessas páginas foi implementada ainda.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  implemented: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Geral",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, implemented: true },
      { label: "Ambientes", href: "#", icon: Layers, implemented: false },
      { label: "Dispositivos", href: "#", icon: Cpu, implemented: false },
    ],
  },
  {
    title: "Automação",
    items: [
      { label: "Automações", href: "#", icon: Workflow, implemented: false },
      { label: "Plugins", href: "#", icon: Puzzle, implemented: false },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Monitoramento", href: "#", icon: Activity, implemented: false },
      { label: "Configurações", href: "#", icon: Settings, implemented: false },
    ],
  },
];
