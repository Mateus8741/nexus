import { EventEmitter } from "node:events";
import os from "node:os";

import { createSystemActions, discoverCore, getOrCreateAgentId, WindowsAgent } from "@nexus/agent-windows";

import type { AgentStatus } from "../shared/types";
import { toWsUrl } from "./core-client";

export interface AgentSettings {
  readonly enabled: boolean;
  readonly coreUrl: string;
  readonly deviceName: string;
}

/**
 * Roda o Agent (o mesmo código de apps/agent-windows) dentro do app. O
 * Agent só fala por console; aqui os logs `[agent-windows]` viram
 * AgentStatus para a UI.
 */
export class AgentService extends EventEmitter {
  private agent: WindowsAgent | undefined;
  private status: AgentStatus = { state: "disabled" };
  private generation = 0;

  constructor() {
    super();
    this.hookConsole();
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  private setStatus(status: AgentStatus): void {
    this.status = status;
    this.emit("status", status);
  }

  private hookConsole(): void {
    for (const method of ["log", "warn", "error"] as const) {
      const original = console[method].bind(console);
      console[method] = (...args: unknown[]): void => {
        original(...args);
        const line = args.map(String).join(" ");
        if (!line.startsWith("[agent-windows]") || !this.agent) return;
        if (line.includes("Aguardando aprovação")) this.setStatus({ state: "pending", detail: "Aprove este PC no Dashboard → Agents." });
        else if (line.includes("Agent aprovado")) this.setStatus({ state: "starting" });
        else if (line.includes("conectado a") && this.status.state !== "pending") this.setStatus({ state: "online" });
        else if (line.includes("desconectado")) this.setStatus({ state: "offline", detail: "Reconectando…" });
        else if (line.includes("Registro rejeitado")) this.setStatus({ state: "rejected", detail: line.split(": ").slice(1).join(": ") });
      };
    }
  }

  async apply(settings: AgentSettings): Promise<void> {
    const generation = ++this.generation;
    this.agent?.stop();
    this.agent = undefined;
    if (!settings.enabled) {
      this.setStatus({ state: "disabled" });
      return;
    }
    this.setStatus({ state: "starting" });

    let coreUrl = toWsUrl(settings.coreUrl);
    if (!coreUrl) {
      const found = await discoverCore();
      if (generation !== this.generation) return;
      if (!found) {
        this.setStatus({ state: "offline", detail: "Core não encontrado na rede local." });
        return;
      }
      coreUrl = `ws://${found.host}:${found.port}`;
    }

    this.agent = new WindowsAgent({
      coreUrl,
      agentId: getOrCreateAgentId(),
      deviceName: settings.deviceName || os.hostname(),
      systemActions: createSystemActions(),
    });
    this.agent.start();
  }

  stop(): void {
    this.generation++;
    this.agent?.stop();
    this.agent = undefined;
  }
}
