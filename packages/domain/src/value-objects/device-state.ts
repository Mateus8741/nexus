/**
 * DeviceState — snapshot imutável do estado observado de um dispositivo.
 *
 * Puramente abstrato: nenhum tipo de dispositivo é assumido. Um sensor, uma
 * luz, um servidor e uma câmera cabem todos no mesmo formato — a diferença
 * está em quais chaves aparecem em `attributes`, e isso é decidido por cada
 * DeviceProvider, não por este tipo.
 */

/** Valor de um atributo de estado. Sempre serializável (JSON-safe). */
export type DeviceAttributeValue = string | number | boolean | null;

/**
 * Conectividade do dispositivo com o seu provider — não confundir com o
 * atributo "ligado/desligado" de um dispositivo (isso é só mais uma entrada
 * em `attributes`, ex.: `{ power: "on" }`).
 */
export type DeviceConnectionStatus = "online" | "offline" | "unknown";

export interface DeviceState {
  readonly status: DeviceConnectionStatus;
  /** Atributos observados no momento do snapshot. Formato livre por dispositivo. */
  readonly attributes: Readonly<Record<string, DeviceAttributeValue>>;
  /** Quando este snapshot foi observado (não necessariamente "agora"). */
  readonly observedAt: Date;
}
