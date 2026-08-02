import type { DeviceState } from "../value-objects/device-state";

/**
 * Uma capacidade que um dispositivo declara suportar (ex.: "on-off",
 * "brightness", "temperature-sensor"). O vocabulário de capacidades é aberto
 * — quem define o que existe é cada DeviceProvider, nunca este tipo.
 */
export interface DeviceCapability {
  readonly key: string;
  /** Ações permitidas por essa capability (ex.: `["turn_on", "turn_off"]` para "on-off"). */
  readonly actions?: readonly string[];
}

/**
 * Device — entidade de domínio que representa qualquer coisa controlável
 * ou observável dentro de um Ambiente/Espaço (ver PROJECT.md): uma luz, um
 * sensor, um servidor, uma câmera, um container, uma VM. `kind` é sempre
 * genérico — nenhum fabricante ou protocolo tem tratamento especial.
 *
 * Abstração pura: este arquivo não sabe como um Device é descoberto,
 * persistido ou controlado — isso é responsabilidade de DeviceProvider e
 * DeviceRegistry.
 */
export interface Device {
  /** Identificador estável dentro do Nexus — não é o id nativo do fabricante/protocolo. */
  readonly id: string;
  /** Id do DeviceProvider que descobriu/controla este dispositivo. */
  readonly providerId: string;
  /** Id nativo do dispositivo dentro do provider (ex.: entity_id, MAC, container id). Opaco para o resto do sistema. */
  readonly externalId: string;
  readonly name: string;
  /** Categoria genérica do dispositivo (ex.: "light", "sensor", "server", "camera", "container"). */
  readonly kind: string;
  readonly capabilities: readonly DeviceCapability[];
  /**
   * Id do Espaço/Ambiente onde o dispositivo está. Tipado como `string` por
   * enquanto — @nexus/domain ainda não tem a entidade Espaço/Ambiente
   * implementada (ver ARCHITECTURE.md, "Próximos passos").
   */
  readonly spaceId?: string;
  readonly state: DeviceState;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
