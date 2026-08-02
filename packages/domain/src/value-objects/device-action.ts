import type { DeviceState } from "./device-state";

/**
 * DeviceAction — comando abstrato a ser executado em um dispositivo.
 *
 * `type` e `payload` são deliberadamente livres (strings/objetos genéricos):
 * quem define o vocabulário de ações válidas para um dispositivo é o
 * DeviceProvider correspondente, através de `DeviceCapability.actions` (ver
 * entities/device.ts) — este tipo não tenta enumerar ações conhecidas.
 */
export interface DeviceAction {
  /** Nome da ação, definido pelo provider (ex.: "turn_on", "set_brightness"). */
  readonly type: string;
  /** Parâmetros da ação (ex.: `{ brightness: 80 }`). */
  readonly payload?: Readonly<Record<string, unknown>>;
}

/** Resultado de tentar executar uma DeviceAction. */
export interface DeviceActionResult {
  readonly success: boolean;
  /** Presente quando `success` é `false`. */
  readonly error?: string;
  /** Estado resultante, se o provider souber informar de imediato (sem round-trip extra). */
  readonly resultingState?: DeviceState;
}
