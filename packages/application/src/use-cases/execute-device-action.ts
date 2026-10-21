import type {
  ActorContext,
  DeviceAction,
  DeviceActionResult,
  DeviceProviderRegistry,
  DeviceRegistry,
  EventBus,
  PermissionKey,
  PermissionService,
  SystemEvent,
} from "@nexus/domain";
import { PERMISSION_KEYS, PermissionDeniedError } from "@nexus/domain";

/**
 * Só ações com permissão própria declarada (shutdown, restart, lock,
 * executeCommand…) são gateadas individualmente. As demais (liga/desliga,
 * brilho, cor, data point — plugins como o Tuya) caem sob `device.write`;
 * exigir `action.<tipo>` para elas negava tudo a quem não é Owner, já que
 * essas chaves nunca foram semeadas nos papéis.
 */
const GATED_ACTIONS: ReadonlySet<string> = new Set(
  PERMISSION_KEYS.filter((key) => key.startsWith("action.")),
);

export interface ExecuteDeviceActionInput {
  readonly deviceId: string;
  readonly action: DeviceAction;
  readonly actor: ActorContext;
}

/**
 * Action Dispatcher universal — exige permissões via PermissionService
 * antes de delegar ao provider.
 */
export class ExecuteDeviceActionUseCase {
  constructor(
    private readonly deviceRegistry: DeviceRegistry,
    private readonly providerRegistry: DeviceProviderRegistry,
    private readonly permissionService: PermissionService,
    private readonly eventBus: EventBus<SystemEvent>,
  ) {}

  async execute(input: ExecuteDeviceActionInput): Promise<DeviceActionResult> {
    try {
      await this.permissionService.require(input.actor, "device.write", {
        workspaceId: input.actor.workspaceId,
        deviceId: input.deviceId,
      });
      const actionPermission: PermissionKey = `action.${input.action.type}`;
      if (GATED_ACTIONS.has(actionPermission)) {
        await this.permissionService.require(input.actor, actionPermission, {
          workspaceId: input.actor.workspaceId,
          deviceId: input.deviceId,
        });
      }
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return { success: false, error: error.message };
      }
      throw error;
    }

    const device = this.deviceRegistry.get(input.deviceId);
    if (!device) {
      return { success: false, error: `Dispositivo "${input.deviceId}" não encontrado.` };
    }

    // Ator restrito a um Space (ver ActorContext.spaceId) só pode agir sobre
    // dispositivos desse mesmo ambiente — dispositivos sem spaceId (legado)
    // ou de outro Space ficam fora do alcance dele.
    if (input.actor.spaceId && device.spaceId !== input.actor.spaceId) {
      return { success: false, error: `Dispositivo "${input.deviceId}" fora do seu ambiente.` };
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
      this.eventBus.publish({
        type: "device.error",
        deviceId: device.id,
        occurredAt: new Date(),
        workspaceId: input.actor.workspaceId,
        message: result.error ?? `Falha ao executar a ação "${input.action.type}".`,
      });
    }

    return result;
  }
}
