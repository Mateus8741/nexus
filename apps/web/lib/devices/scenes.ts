import { type DeviceView, findAction, powerActionFor } from "@/lib/devices/view";

export type SceneId = "bright" | "cozy" | "movie" | "night" | "away";

/** Um passo concreto de uma cena: ação a enviar + efeito otimista na UI. */
export interface SceneStep {
  readonly deviceId: string;
  readonly actionType: string;
  readonly patch?: { readonly on: boolean };
}

export interface SceneDefinition {
  readonly id: SceneId;
  readonly label: string;
  readonly description: string;
  /** Cor de atmosfera usada pela cena isométrica (CSS color). */
  readonly tint: string;
  /** 0–1: quanto a sala "escurece" na ilustração. */
  readonly ambient: number;
  readonly plan: (views: readonly DeviceView[]) => SceneStep[];
}

function powerStep(view: DeviceView, wantOn: boolean): SceneStep | null {
  if (!view.supportsPower || !view.online || view.isOn === wantOn) return null;
  const actionType = powerActionFor(view, wantOn);
  return actionType ? { deviceId: view.device.id, actionType, patch: { on: wantOn } } : null;
}

function steps(
  views: readonly DeviceView[],
  rule: (view: DeviceView) => boolean | undefined,
): SceneStep[] {
  const result: SceneStep[] = [];
  for (const view of views) {
    const want = rule(view);
    if (want === undefined) continue;
    const step = powerStep(view, want);
    if (step) result.push(step);
  }
  return result;
}

/** Liga (ou desliga) tudo que tem controle de energia nos dispositivos dados. */
export function planPower(views: readonly DeviceView[], wantOn: boolean): SceneStep[] {
  return steps(views, (view) => (view.supportsPower ? wantOn : undefined));
}

const ACCENT_PLUG = /tv|led|fita|backlight|abajur|lamp/i;

/**
 * Cenas são presets puros sobre os dispositivos visíveis — viram chamadas
 * turn_on/turn_off comuns, sem nenhum caso especial por fabricante.
 */
export const SCENES: readonly SceneDefinition[] = [
  {
    id: "bright",
    label: "Claro",
    description: "Luzes e tomadas ligadas",
    tint: "oklch(0.92 0.08 95)",
    ambient: 1,
    plan: (views) =>
      steps(views, (v) => (v.category === "light" || v.category === "plug" ? true : undefined)),
  },
  {
    id: "cozy",
    label: "Aconchego",
    description: "Luz suave e clima agradável",
    tint: "oklch(0.78 0.14 60)",
    ambient: 0.75,
    plan: (views) =>
      steps(views, (v) => {
        if (v.category === "light") return true;
        if (v.category === "plug") return ACCENT_PLUG.test(v.device.name);
        if (v.category === "climate") return true;
        return undefined;
      }),
  },
  {
    id: "movie",
    label: "Cinema",
    description: "Só o brilho atrás da TV",
    tint: "oklch(0.62 0.2 285)",
    ambient: 0.45,
    plan: (views) =>
      steps(views, (v) => {
        if (v.category === "light") return false;
        if (v.category === "plug") return /tv|led|fita|backlight/i.test(v.device.name);
        if (v.category === "climate") return true;
        return undefined;
      }),
  },
  {
    id: "night",
    label: "Noite",
    description: "Tudo apagado",
    tint: "oklch(0.55 0.15 262)",
    ambient: 0.3,
    plan: (views) =>
      steps(views, (v) => (v.category === "light" || v.category === "plug" ? false : undefined)),
  },
  {
    id: "away",
    label: "Fora",
    description: "Desliga tudo e bloqueia os PCs",
    tint: "oklch(0.6 0.03 250)",
    ambient: 0.22,
    plan: (views) => {
      const result = steps(views, (v) => (v.supportsPower ? false : undefined));
      for (const view of views) {
        if (view.category !== "computer" || !view.online) continue;
        const lock = findAction(view, "lock");
        if (lock) result.push({ deviceId: view.device.id, actionType: lock.actionType });
      }
      return result;
    },
  },
];

export function getScene(id: SceneId): SceneDefinition {
  return SCENES.find((scene) => scene.id === id) ?? (SCENES[0] as SceneDefinition);
}
