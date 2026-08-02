import type {
  ActorContext,
  DeviceAction,
  DeviceActionResult,
  DeviceProviderRegistry,
  DeviceRegistry,
  EventBus,
  PermissionService,
  SystemEvent,
} from "@nexus/domain";
import { PermissionDeniedError } from "@nexus/domain";

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
      await this.permissionService.require(input.actor, `action.${input.action.type}`, {
        workspaceId: input.actor.workspaceId,
        deviceId: input.deviceId,
      });
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
