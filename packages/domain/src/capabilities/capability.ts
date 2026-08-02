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
  readonly payloadSchema?: Readonly<Record<string, "string" | "number" | "boolean">>;
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
