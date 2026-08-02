import type { Device } from "../entities/device";
import type { DeviceEvent } from "../events/device-event";
import type { DeviceAction, DeviceActionResult } from "../value-objects/device-action";
import type { DeviceState } from "../value-objects/device-state";

/** Identidade de um provider — não confundir com o manifesto de um plugin (@nexus/plugins-sdk); um plugin pode expor zero, um ou vários providers. */
export interface DeviceProviderDescriptor {
  readonly id: string;
  readonly name: string;
}

/**
 * DeviceProvider — port que qualquer integração concreta (Home Assistant,
 * MQTT, Proxmox, Docker, Windows, Tuya, um scanner de rede genérico, etc.)
 * implementa para expor os dispositivos que ela conhece.
 *
 * Só a abstração existe aqui — nenhuma implementação concreta (nenhum
 * "Windows", "Tuya" ou "Docker") faz parte deste pacote. Essas
 * implementações vivem em @nexus/infrastructure/adapters ou em pacotes de
 * plugin (packages/plugins/*), nunca em @nexus/domain.
 */
export interface DeviceProvider {
  readonly descriptor: DeviceProviderDescriptor;

  /** Lista os dispositivos atualmente conhecidos por este provider. */
  listDevices(): Promise<readonly Device[]>;

  /** Estado atual de um dispositivo específico, se o provider souber informar sob demanda. */
  getState(deviceId: string): Promise<DeviceState | undefined>;

  /** Executa uma ação em um dispositivo. Como isso acontece (rede, protocolo nativo, SDK do fabricante) é decisão exclusiva do provider. */
  executeAction(deviceId: string, action: DeviceAction): Promise<DeviceActionResult>;

  /** Assina os eventos emitidos pelos dispositivos deste provider. Retorna uma função para cancelar a assinatura. */
  subscribe(listener: (event: DeviceEvent) => void): () => void;
}
