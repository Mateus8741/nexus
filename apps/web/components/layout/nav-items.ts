import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Cpu,
  Download,
  KeyRound,
  Layers,
  LayoutDashboard,
  Puzzle,
  ScrollText,
  Server,
  Settings,
  Shield,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";

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
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, implemented: true },
      { label: "Ambientes", href: "/spaces", icon: Layers, implemented: true },
      { label: "Downloads", href: "/downloads", icon: Download, implemented: true },
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
    title: "Segurança",
    items: [
      { label: "Usuários", href: "/users", icon: Users, implemented: true },
      { label: "Agents", href: "/agents", icon: Server, implemented: true },
      { label: "Agents pendentes", href: "/agents/pending", icon: Shield, implemented: true },
      { label: "API Keys", href: "/api-keys", icon: KeyRound, implemented: true },
      { label: "Papéis", href: "/roles", icon: UserRound, implemented: true },
      { label: "Sessões", href: "/sessions", icon: Activity, implemented: true },
      { label: "Auditoria", href: "/audit", icon: ScrollText, implemented: true },
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
