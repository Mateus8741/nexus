import type {
  AgentActionPayload,
  AgentActionResultMessage,
  AgentMetricsSnapshot,
  AgentRegisterMessage,
} from "@nexus/agent-protocol";
import { AGENT_PROTOCOL_VERSION, isAgentActionType, isAgentMessage } from "@nexus/agent-protocol";
import type {
  Device,
  DeviceAction,
  DeviceActionResult,
  DeviceEvent,
  DeviceProvider,
  DeviceProviderDescriptor,
  DeviceState,
  HealthMonitor,
} from "@nexus/domain";
import type { AgentConnection, AgentGateway } from "@nexus/plugins-sdk";

const DESCRIPTOR: DeviceProviderDescriptor = { id: "nexus.windows", name: "Windows" };

/** Quanto tempo esperar por um `action-result` antes de desistir. */
const ACTION_TIMEOUT_MS = 15_000;

interface TrackedDevice {
  device: Device;
  connection: AgentConnection;
}

interface PendingAction {
  resolve: (result: DeviceActionResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

type DeviceEventListener = (event: DeviceEvent) => void;

/**
 * WindowsDeviceProvider — implementa DeviceProvider (@nexus/domain) para
 * computadores Windows. Não fala com o Windows diretamente: recebe um
 * AgentGateway (transporte agnóstico, injetado pelo host) e conversa com
 * quem estiver do outro lado da conexão usando @nexus/agent-protocol.
 *
 * Cada conexão aceita pelo gateway deve, na primeira mensagem, se
 * identificar com um `register` — só a partir daí o dispositivo existe
 * para este provider. `agentId` (vindo do Agent, persistido localmente por
 * ele) é usado como Device.id, garantindo que reconexões sejam reconhecidas
 * como o mesmo dispositivo.
 *
 * O rastreamento de heartbeat/timeout é delegado a um HealthMonitor
 * injetado (@nexus/domain) em vez de implementado aqui — ver
 * ARCHITECTURE.md, "Health Service". Este provider só decide O QUE fazer
 * quando o timeout dispara (marcar offline, emitir evento); o mecanismo de
 * timer em si é compartilhado com qualquer plugin futuro.
 */
export class WindowsDeviceProvider implements DeviceProvider {
  readonly descriptor = DESCRIPTOR;

  private readonly tracked = new Map<string, TrackedDevice>();
  private readonly pendingActions = new Map<string, PendingAction>();
  private readonly listeners = new Set<DeviceEventListener>();

  constructor(
    agentGateway: AgentGateway,
    private readonly healthMonitor: HealthMonitor,
  ) {
    agentGateway.onConnection((connection) => {
      connection.onMessage((raw) => this.handleMessage(connection, raw));
      connection.onClose(() => this.handleConnectionClosed(connection));
    });
  }

  async listDevices(): Promise<readonly Device[]> {
    return Array.from(this.tracked.values(), (entry) => entry.device);
  }

  async getState(deviceId: string): Promise<DeviceState | undefined> {
    return this.tracked.get(deviceId)?.device.state;
  }

  async executeAction(deviceId: string, action: DeviceAction): Promise<DeviceActionResult> {
    const entry = this.tracked.get(deviceId);
    if (!entry) {
      return { success: false, error: `Dispositivo "${deviceId}" desconhecido.` };
    }
    if (entry.device.state.status !== "online") {
      return { success: false, error: "Dispositivo está offline." };
    }
    if (!isAgentActionType(action.type)) {
      return { success: false, error: `Ação "${action.type}" não é suportada pelo Windows Agent.` };
    }

    let payload: AgentActionPayload | undefined;
    if (action.type === "executeCommand") {
      const command = action.payload?.command;
      if (typeof command !== "string" || command.trim().length === 0) {
        return { success: false, error: 'Ação "executeCommand" exige payload.command (string).' };
      }
      payload = { command };
    }

    const requestId = crypto.randomUUID();
    const result = await new Promise<DeviceActionResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingActions.delete(requestId);
        resolve({ success: false, error: "Tempo esgotado aguardando resposta do Agent." });
      }, ACTION_TIMEOUT_MS);

      this.pendingActions.set(requestId, { resolve, timer });
      entry.connection.send({ type: "action-command", requestId, action: action.type, payload });
    });

    this.emit({ type: "device.action-executed", deviceId, occurredAt: new Date(), action, result });
    return result;
  }

  subscribe(listener: DeviceEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: DeviceEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private handleMessage(connection: AgentConnection, raw: unknown): void {
    if (!isAgentMessage(raw)) return; // mensagem malformada — ignorada, não derruba a conexão

    switch (raw.type) {
      case "register":
        this.handleRegister(connection, raw);
        return;
      case "heartbeat":
        this.handleHeartbeat(raw.agentId);
        return;
      case "metrics":
        this.handleMetrics(raw.agentId, raw.metrics);
        return;
      case "action-result":
        this.handleActionResult(raw);
        return;
      default: {
        const exhaustiveCheck: never = raw;
        void exhaustiveCheck;
      }
    }
  }

  private handleRegister(connection: AgentConnection, message: AgentRegisterMessage): void {
    if (message.protocolVersion !== AGENT_PROTOCOL_VERSION) {
      connection.close(
        1002,
        `Versão de protocolo incompatível: esperado ${AGENT_PROTOCOL_VERSION}, recebido ${message.protocolVersion}.`,
      );
      return;
    }

    const deviceId = message.agentId;
    const now = new Date();

    const device: Device = {
      id: deviceId,
      providerId: DESCRIPTOR.id,
      externalId: deviceId,
      name: message.name,
      kind: "computer",
      capabilities: [
        { key: "power-control", actions: ["shutdown", "restart", "lock"] },
        { key: "remote-command", actions: ["executeCommand"] },
        { key: "metrics" },
      ],
      state: {
        status: "online",
        attributes: {
          hostname: message.system.hostname,
          operatingSystemName: message.system.operatingSystem.name,
          operatingSystemVersion: message.system.operatingSystem.version,
          ipAddress: message.system.ipAddress,
        },
        observedAt: now,
      },
    };

    this.tracked.set(deviceId, { device, connection });
    this.healthMonitor.heartbeat(deviceId, () => this.handleHeartbeatTimeout(deviceId));

    this.emit({ type: "device.connected", deviceId, occurredAt: now });
  }

  private handleHeartbeat(agentId: string): void {
    const entry = this.tracked.get(agentId);
    if (!entry) return; // heartbeat de um agent que nunca fez register — ignorado
    this.healthMonitor.heartbeat(agentId, () => this.handleHeartbeatTimeout(agentId));
  }

  private handleMetrics(agentId: string, metrics: AgentMetricsSnapshot): void {
    const entry = this.tracked.get(agentId);
    if (!entry) return;
    this.healthMonitor.heartbeat(agentId, () => this.handleHeartbeatTimeout(agentId));

    const now = new Date();
    const previousState = entry.device.state;
    const currentState: DeviceState = {
      status: "online",
      attributes: {
        ...previousState.attributes,
        cpuUsagePercent: metrics.cpuUsagePercent,
        ramUsagePercent: metrics.ramUsagePercent,
        diskUsagePercent: metrics.diskUsagePercent,
        uptimeSeconds: metrics.uptimeSeconds,
      },
      observedAt: now,
    };
    entry.device = { ...entry.device, state: currentState };

    this.emit({
      type: "device.state-changed",
      deviceId: agentId,
      occurredAt: now,
      previousState,
      currentState,
    });
  }

  private handleActionResult(message: AgentActionResultMessage): void {
    const pending = this.pendingActions.get(message.requestId);
    if (!pending) return; // resposta atrasada de uma ação que já expirou, ou requestId desconhecido
    clearTimeout(pending.timer);
    this.pendingActions.delete(message.requestId);
    pending.resolve({ success: message.success, error: message.error });
  }

  private handleConnectionClosed(connection: AgentConnection): void {
    for (const [deviceId, entry] of this.tracked) {
      if (entry.connection === connection) {
        // Desconexão explícita (socket fechado) — o HealthMonitor não
        // precisa mais rastrear este dispositivo; sem isto, o timer de
        // timeout ainda pendente dispararia depois, tentando marcar
        // offline de novo (markOffline() é idempotente, mas o
        // stopTracking evita o timer órfão desde já).
        this.healthMonitor.stopTracking(deviceId);
        this.markOffline(deviceId, entry, "connection-closed");
        return;
      }
    }
  }

  private handleHeartbeatTimeout(deviceId: string): void {
    const entry = this.tracked.get(deviceId);
    if (entry) this.markOffline(deviceId, entry, "heartbeat-timeout");
  }

  private markOffline(deviceId: string, entry: TrackedDevice, reason: string): void {
    if (entry.device.state.status === "offline") return; // já offline, evita evento duplicado

    const now = new Date();
    const previousState = entry.device.state;
    const currentState: DeviceState = { ...previousState, status: "offline", observedAt: now };
    entry.device = { ...entry.device, state: currentState };

    this.emit({ type: "device.disconnected", deviceId, occurredAt: now, reason });
  }
}
