import type { NexusDatabase } from "@nexus/db";
import { devices } from "@nexus/db";
import type { Device, DeviceCapability, DeviceRepository, DeviceState } from "@nexus/domain";
import { eq } from "drizzle-orm";

/**
 * Linhas antigas guardavam `capabilities` como `string[]` (só as keys, sem
 * `actions` — bug já corrigido, ver schema/platform.ts). Aceita os dois
 * formatos aqui pra não quebrar dispositivos hidratados de antes do fix; o
 * formato rico é regravado na próxima vez que o provider re-registrar esse
 * device (ver AttachDeviceProviderUseCase, que agora sempre chama
 * `register()`, não só `updateState()`).
 */
function rowToCapabilities(raw: unknown): DeviceCapability[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) =>
    typeof entry === "string" ? { key: entry } : (entry as DeviceCapability),
  );
}

function rowToDevice(row: typeof devices.$inferSelect): Device {
  return {
    id: row.id,
    providerId: row.providerId,
    externalId: row.externalId,
    name: row.name,
    kind: row.kind,
    capabilities: rowToCapabilities(row.capabilities),
    spaceId: row.spaceId ?? undefined,
    state: row.state as unknown as DeviceState,
    metadata: row.metadata ?? undefined,
  };
}

export class PostgresDeviceRepository implements DeviceRepository {
  constructor(private readonly db: NexusDatabase) {}

  async upsert(device: Device & { workspaceId: string }): Promise<void> {
    // Grava o objeto completo (`key` + `actions`), não só a key — ver
    // rowToCapabilities() acima para o motivo dessa mudança.
    const capabilities = device.capabilities.map((cap) => ({
      key: cap.key,
      ...(cap.actions ? { actions: [...cap.actions] } : {}),
    }));
    await this.db
      .insert(devices)
      .values({
        id: device.id,
        workspaceId: device.workspaceId,
        spaceId: device.spaceId,
        providerId: device.providerId,
        externalId: device.externalId,
        name: device.name,
        kind: device.kind,
        capabilities,
        state: device.state as unknown as Record<string, unknown>,
        metadata: device.metadata,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: devices.id,
        set: {
          name: device.name,
          kind: device.kind,
          capabilities,
          state: device.state as unknown as Record<string, unknown>,
          metadata: device.metadata,
          spaceId: device.spaceId,
          updatedAt: new Date(),
        },
      });
  }

  async get(deviceId: string): Promise<Device | undefined> {
    const rows = await this.db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
    const row = rows[0];
    return row ? rowToDevice(row) : undefined;
  }

  async list(workspaceId?: string): Promise<readonly Device[]> {
    const rows = workspaceId
      ? await this.db.select().from(devices).where(eq(devices.workspaceId, workspaceId))
      : await this.db.select().from(devices);
    return rows.map(rowToDevice);
  }

  async updateState(deviceId: string, state: DeviceState): Promise<void> {
    await this.db
      .update(devices)
      .set({ state: state as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(devices.id, deviceId));
  }

  async remove(deviceId: string): Promise<void> {
    await this.db.delete(devices).where(eq(devices.id, deviceId));
  }
}
