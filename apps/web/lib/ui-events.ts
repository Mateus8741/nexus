import type { SceneId } from "@/lib/devices/scenes";

/** Eventos de janela que ligam a command palette ao dashboard (que escuta e age). */
export const SCENE_EVENT = "nexus:scene";
export const OPEN_PALETTE_EVENT = "nexus:open-palette";

export function requestScene(id: SceneId): void {
  window.dispatchEvent(new CustomEvent<SceneId>(SCENE_EVENT, { detail: id }));
}
