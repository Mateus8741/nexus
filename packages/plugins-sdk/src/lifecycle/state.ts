/**
 * Estados possíveis de um plugin registrado. Puramente declarativo — este
 * módulo não executa nada, só descreve o que é uma transição válida. Quem
 * aplica as transições é o PluginRegistry.
 */
export type PluginState = "registered" | "starting" | "started" | "stopping" | "stopped" | "error";

export const PLUGIN_STATE_TRANSITIONS: Readonly<Record<PluginState, readonly PluginState[]>> = {
  registered: ["starting", "error"],
  starting: ["started", "error"],
  started: ["stopping", "error"],
  stopping: ["stopped", "error"],
  stopped: ["starting", "error"],
  error: ["starting"],
};

export function canTransition(from: PluginState, to: PluginState): boolean {
  return PLUGIN_STATE_TRANSITIONS[from].includes(to);
}
