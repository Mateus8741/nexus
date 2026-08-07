/**
 * Descrição de um campo de payload. A forma curta (`"string"`/`"number"`/
 * `"boolean"`) continua válida — é só o tipo primitivo, sem mais nada pra
 * UI aproveitar. As formas longas são o mesmo tipo primitivo mais dicas
 * OPCIONAIS pra UI renderizar algo melhor que uma caixa de texto (ex.: um
 * `<select>` em vez de free-text, ou um slider em vez de um input number
 * cru) — nunca validadas em runtime por este tipo, só pelo DeviceProvider
 * na hora de executar (ex.: TuyaDeviceProvider.clampPercent,
 * LgThinqDeviceProvider.assertLegalEnum). Nenhum fabricante especial: é o
 * mesmo formato pra Tuya, LG ThinQ, Windows ou qualquer plugin futuro.
 */
export type CapabilityFieldSchema =
  | "string"
  | "number"
  | "boolean"
  | { readonly type: "string"; readonly options?: readonly string[] }
  | { readonly type: "number"; readonly min?: number; readonly max?: number; readonly step?: number; readonly unit?: string }
  | { readonly type: "boolean" };

/**
 * Descrição de uma ação que uma Capability expõe (ex.: a capability
 * "restart" expõe a ação "restart"; "remote-command" expõe "executeCommand"
 * com um payload `{ command: string }`). `payloadSchema` é só informativo —
 * usado pela UI para saber que campos pedir, nunca validado em runtime por
 * este tipo (quem valida de verdade é o DeviceProvider, na hora de
 * executar).
 */
export interface CapabilityActionSchema {
  readonly type: string;
  readonly label: string;
  readonly payloadSchema?: Readonly<Record<string, CapabilityFieldSchema>>;
  /**
   * Ação técnica/de baixo nível (ex.: escrever um data point Tuya cru,
   * definir um resource/property arbitrário da LG, rodar um comando
   * remoto) — a UI deveria esconder isso atrás de um "Avançado" por
   * padrão, em vez de misturar com ações do dia a dia como "Ligar".
   * `undefined`/`false` = ação comum, sempre visível.
   */
  readonly advanced?: boolean;
}

/** Extrai só o tipo primitivo de um CapabilityFieldSchema, aceitando a forma curta ou a longa. */
export function fieldPrimitiveType(field: CapabilityFieldSchema): "string" | "number" | "boolean" {
  return typeof field === "string" ? field : field.type;
}

/**
 * CapabilityDefinition — o que uma Capability *significa*, registrado uma
 * vez por plugin (não por dispositivo). `Device.capabilities` (ver
 * entities/device.ts) só declara QUE chaves um dispositivo específico tem;
 * este tipo é o dicionário que dá significado a essas chaves (label para
 * UI, quais ações cada uma expõe).
 *
 * Nenhum fabricante tem tratamento especial aqui — "restart", "light" e
 * "logs" são só strings quaisquer que um plugin decide registrar.
 */
export interface CapabilityDefinition {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly actions?: readonly CapabilityActionSchema[];
}
