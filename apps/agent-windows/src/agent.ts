import type {
  AgentActionResultMessage,
  AgentActionType,
  AgentHeartbeatMessage,
  AgentMetricsMessage,
  AgentRegisterMessage,
} from "@nexus/agent-protocol";
import { AGENT_PROTOCOL_VERSION, isCoreMessage } from "@nexus/agent-protocol";
import type { RawData } from "ws";
import { WebSocket } from "ws";

import { clearAgentToken, readAgentToken, writeAgentToken } from "./agent-token";
import { collectMetrics } from "./metrics";
import { CommandExecutionError, type SystemActions } from "./system-actions";
import { collectSystemInfo } from "./system-info";

export interface WindowsAgentOptions {
  readonly coreUrl: string;
  readonly agentId: string;
  readonly deviceName: string;
  readonly systemActions: SystemActions;
  readonly heartbeatIntervalMs?: number;
  readonly metricsIntervalMs?: number;
  readonly reconnectDelayMs?: number;
}

/**
 * WindowsAgent — processo que roda NA máquina Windows monitorada.
 * Persiste token de pareamento e só inicia heartbeat/métricas após aprovação.
 */
export class WindowsAgent {
  private socket: WebSocket | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private metricsTimer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private approved = false;
  private token: string | undefined;

  constructor(private readonly options: WindowsAgentOptions) {
    this.token = readAgentToken();
    this.approved = Boolean(this.token);
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.socket?.close();
  }

  private connect(): void {
    const socket = new WebSocket(this.options.coreUrl);
    this.socket = socket;

    socket.on("open", () => this.handleOpen());
    socket.on("message", (data) => this.handleMessage(data));
    socket.on("close", () => this.handleClose());
    socket.on("error", (error) => {
      console.error(`[agent-windows] erro de conexão: ${error.message}`);
    });
  }

  private handleOpen(): void {
    console.log(
      `[agent-windows] conectado a ${this.options.coreUrl}, registrando "${this.options.deviceName}"...`,
    );

    this.send({
      type: "register",
      agentId: this.options.agentId,
      protocolVersion: AGENT_PROTOCOL_VERSION,
      kind: "windows",
      name: this.options.deviceName,
      system: collectSystemInfo(),
      ...(this.token ? { token: this.token } : {}),
    } satisfies AgentRegisterMessage);

    if (this.token) {
      this.startOperationalLoops();
    }
  }

  private startOperationalLoops(): void {
    if (this.heartbeatTimer || this.metricsTimer) return;
    this.approved = true;
    this.heartbeatTimer = setInterval(
      () => this.sendHeartbeat(),
      this.options.heartbeatIntervalMs ?? 10_000,
    );
    this.metricsTimer = setInterval(
      () => void this.sendMetrics(),
      this.options.metricsIntervalMs ?? 15_000,
    );
    void this.sendMetrics();
  }

  private sendHeartbeat(): void {
    this.send({
      type: "heartbeat",
      agentId: this.options.agentId,
      sentAt: new Date().toISOString(),
    } satisfies AgentHeartbeatMessage);
  }

  private async sendMetrics(): Promise<void> {
    const metrics = await collectMetrics();
    this.send({
      type: "metrics",
      agentId: this.options.agentId,
      collectedAt: new Date().toISOString(),
      metrics,
    } satisfies AgentMetricsMessage);
  }

  private handleMessage(data: RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!isCoreMessage(parsed)) return;

    switch (parsed.type) {
      case "registration-pending":
        console.log(
          "[agent-windows] Aguardando aprovação no Dashboard (pareamento). Não inicie ações ainda.",
        );
        return;
      case "registration-approved":
        writeAgentToken(parsed.token);
        this.token = parsed.token;
        console.log("[agent-windows] Agent aprovado. Token permanente salvo. Reconectando...");
        this.socket?.close();
        return;
      case "registration-rejected":
        console.error(`[agent-windows] Registro rejeitado: ${parsed.reason}`);
        if (parsed.reason === "invalid_token" || parsed.reason === "token_required") {
          clearAgentToken();
          this.token = undefined;
          this.approved = false;
        }
        return;
      case "action-command": {
        if (!this.approved) this.startOperationalLoops();
        const command = parsed.payload?.command;
        void this.executeAction(parsed.requestId, parsed.action, command);
        return;
      }
    }
  }

  private async executeAction(
    requestId: string,
    action: AgentActionType,
    command?: string,
  ): Promise<void> {
    try {
      let output: string | undefined;
      switch (action) {
        case "shutdown":
          await this.options.systemActions.shutdown();
          break;
        case "restart":
          await this.options.systemActions.restart();
          break;
        case "lock":
          await this.options.systemActions.lock();
          break;
        case "executeCommand":
          output = await this.options.systemActions.executeCommand(command ?? "");
          break;
      }
      this.send({
        type: "action-result",
        agentId: this.options.agentId,
        requestId,
        success: true,
        ...(output !== undefined ? { output } : {}),
      } satisfies AgentActionResultMessage);
    } catch (error) {
      const output = error instanceof CommandExecutionError ? error.output : undefined;
      this.send({
        type: "action-result",
        agentId: this.options.agentId,
        requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        ...(output !== undefined && output.length > 0 ? { output } : {}),
      } satisfies AgentActionResultMessage);
    }
  }

  private handleClose(): void {
    this.clearTimers();
    if (this.stopped) return;

    // Após aprovação, o Core reenvia o register com token e o provider
    // aceita — ao reconectar com token, iniciamos loops no primeiro
    // heartbeat implícito: se temos token, consideramos operacional após open.
    const delay = this.options.reconnectDelayMs ?? 5_000;
    console.warn(`[agent-windows] desconectado do Core, tentando reconectar em ${delay}ms...`);
    setTimeout(() => {
      this.connect();
      // Se já temos token, startOperationalLoops após open acontece quando
      // o Core aceitar — o bridge só forwarda após token válido. Ligamos
      // os timers após open se token existir (conexão aprovada esperada).
    }, delay);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    this.heartbeatTimer = undefined;
    this.metricsTimer = undefined;
  }

  private send(message: unknown): void {
    this.socket?.send(JSON.stringify(message));
  }
}
