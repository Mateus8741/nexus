import type { HealthMonitor } from "@nexus/domain";

export interface TimerHealthMonitorOptions {
  /** Tempo sem heartbeat até chamar `onTimeout`. Padrão: 30s. */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Implementação concreta de HealthMonitor (@nexus/domain) usando
 * `setTimeout`. Depender de temporizadores é uma decisão de runtime — por
 * isso vive em @nexus/infrastructure, não em @nexus/application (que é
 * framework-agnostic, sem acesso a globais como setTimeout).
 *
 * Genuinamente genérico: não conhece Device nem DeviceRegistry, só ids
 * (strings) e callbacks — `WindowsDeviceProvider`, por exemplo, usa isto
 * em vez de manter seu próprio timer por dispositivo.
 */
export class TimerHealthMonitor implements HealthMonitor {
  private readonly lastSeenAtByDevice = new Map<string, Date>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly timeoutMs: number;

  constructor(options: TimerHealthMonitorOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  heartbeat(deviceId: string, onTimeout: () => void): void {
    this.lastSeenAtByDevice.set(deviceId, new Date());

    const existing = this.timers.get(deviceId);
    if (existing) clearTimeout(existing);

    this.timers.set(
      deviceId,
      setTimeout(() => {
        this.timers.delete(deviceId);
        onTimeout();
      }, this.timeoutMs),
    );
  }

  lastSeenAt(deviceId: string): Date | undefined {
    return this.lastSeenAtByDevice.get(deviceId);
  }

  stopTracking(deviceId: string): void {
    const timer = this.timers.get(deviceId);
    if (timer) clearTimeout(timer);
    this.timers.delete(deviceId);
    this.lastSeenAtByDevice.delete(deviceId);
  }
}
