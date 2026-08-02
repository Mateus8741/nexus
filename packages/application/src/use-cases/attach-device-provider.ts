import type { Device, DeviceEvent, DeviceProvider, DeviceRegistry } from "@nexus/domain";

/**
 * AttachDeviceProviderUseCase — conecta QUALQUER DeviceProvider a um
 * DeviceRegistry: registra os dispositivos que ele já conhece e mantém o
 * registry sincronizado com os eventos que ele emitir depois.
 *
 * Não sabe nada sobre Windows, Docker, Home Assistant ou Tuya — só conhece
 * as abstrações de @nexus/domain. É por isso que esta classe não muda
 * quando um novo provider é criado: Windows, Docker, Home Assistant e Tuya
 * usam exatamente este mesmo caso de uso, sem alteração nenhuma.
 */
export class AttachDeviceProviderUseCase {
  private queue: Promise<void> = Promise.resolve();

  /**
   * `onError` é opcional e deliberadamente não tem um padrão que escreva em
   * qualquer lugar (console, arquivo, etc.) — @nexus/application não pode
   * depender de globais de runtime nem de framework. Quem quiser observar
   * falhas (ex.: apps/plugin-host, via seu PluginLogger) passa um callback.
   */
  constructor(
    private readonly deviceRegistry: DeviceRegistry,
    private readonly onError?: (error: unknown, event: DeviceEvent) => void,
  ) {}

  /**
   * @returns função para desanexar o provider (cancela a assinatura de eventos).
   */
  async attach(provider: DeviceProvider): Promise<() => void> {
    const initialDevices = await provider.listDevices();
    for (const device of initialDevices) {
      this.upsert(device);
    }

    return provider.subscribe((event) => {
      // Processado em fila, um de cada vez: alguns ramos de handleEvent são
      // async (ex.: "device.connected" chama provider.listDevices()) e
      // outros são síncronos (ex.: "device.state-changed") — sem essa fila,
      // um evento síncrono que chega logo depois de um assíncrono poderia
      // ser publicado no registry (notify) FORA de ordem. Um erro num
      // evento não pode impedir os próximos de serem processados.
      this.queue = this.queue
        .then(() => this.handleEvent(provider, event))
        .catch((error: unknown) => {
          this.onError?.(error, event);
        });
    });
  }

  private upsert(device: Device): void {
    if (this.deviceRegistry.has(device.id)) {
      this.deviceRegistry.updateState(device.id, device.state);
    } else {
      this.deviceRegistry.register(device);
    }
  }

  private async handleEvent(provider: DeviceProvider, event: DeviceEvent): Promise<void> {
    switch (event.type) {
      case "device.connected": {
        await this.syncFromProvider(provider, event.deviceId);
        break;
      }
      case "device.state-changed": {
        this.deviceRegistry.updateState(event.deviceId, event.currentState);
        break;
      }
      case "device.disconnected": {
        const state = await provider.getState(event.deviceId);
        if (state) this.deviceRegistry.updateState(event.deviceId, state);
        break;
      }
      case "device.action-executed":
      case "device.error": {
        // Não alteram identidade nem estado do dispositivo por si só — só
        // são repassados para quem estiver assinado no registry.
        break;
      }
      default: {
        const exhaustiveCheck: never = event;
        void exhaustiveCheck;
      }
    }

    // Repassa o evento original (com toda a fidelidade que só o provider
    // tem) para quem estiver assinado no registry — ver DeviceRegistry.notify.
    this.deviceRegistry.notify(event);
  }

  private async syncFromProvider(provider: DeviceProvider, deviceId: string): Promise<void> {
    const devices = await provider.listDevices();
    const device = devices.find((candidate) => candidate.id === deviceId);
    if (device) this.upsert(device);
  }
}
