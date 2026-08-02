import type {
  DeviceAction,
  DeviceActionResult,
  DeviceProviderRegistry,
  DeviceRegistry,
} from "@nexus/domain";

export interface ExecuteDeviceActionInput {
  readonly deviceId: string;
  readonly action: DeviceAction;
}

/**
 * ExecuteDeviceActionUseCase — o "Action Dispatcher" universal (ver
 * ARCHITECTURE.md). É o único jeito pelo qual qualquer parte do sistema
 * (a API HTTP do plugin-host, uma futura automação, um comando de voz)
 * deve executar uma ação em um dispositivo: `execute({ deviceId, action })`,
 * nunca uma chamada direta tipo `windowsProvider.executeAction(...)`.
 *
 * Acha o dispositivo via DeviceRegistry, acha o provider certo via
 * DeviceProviderRegistry — nenhum dos dois passos sabe ou pergunta que
 * fabricante/protocolo está por trás.
 *
 * NÃO notifica "device.action-executed" diretamente: o próprio provider já
 * faz isso (ver WindowsDeviceProvider.executeAction, que chama this.emit()
 * ao final) através do pipeline já estabelecido
 * provider.subscribe() -> AttachDeviceProviderUseCase -> DeviceRegistry.notify()
 * -> EventBus. Notificar aqui TAMBÉM duplicaria o evento (confirmado via
 * smoke test: /events mostrava dois "device.action-executed" idênticos
 * para a mesma ação). O provider continua sendo a única fonte de verdade
 * para os eventos dos seus próprios dispositivos, o mesmo princípio já
 * aplicado ao HealthMonitor (ver ARCHITECTURE.md, "Health Service").
 *
 * "device.error" é diferente: nenhum provider emite esse tipo hoje, então
 * publicá-lo aqui (só quando a ação falha) não duplica nada — é este caso
 * de uso que decide que uma falha de ação também vira um erro de auditoria.
 */
export class ExecuteDeviceActionUseCase {
  constructor(
    private readonly deviceRegistry: DeviceRegistry,
    private readonly providerRegistry: DeviceProviderRegistry,
  ) {}

  async execute(input: ExecuteDeviceActionInput): Promise<DeviceActionResult> {
    const device = this.deviceRegistry.get(input.deviceId);
    if (!device) {
      return { success: false, error: `Dispositivo "${input.deviceId}" não encontrado.` };
    }

    const provider = this.providerRegistry.get(device.providerId);
    if (!provider) {
      return {
        success: false,
        error: `Provider "${device.providerId}" não encontrado (dispositivo pode estar órfão).`,
      };
    }

    const result = await provider.executeAction(device.id, input.action);

    if (!result.success) {
      this.deviceRegistry.notify({
        type: "device.error",
        deviceId: device.id,
        occurredAt: new Date(),
        message: result.error ?? `Falha ao executar a ação "${input.action.type}".`,
      });
    }

    return result;
  }
}
