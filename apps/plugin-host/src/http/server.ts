import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";

import { toDeviceDto, toDeviceEventDto } from "@nexus/application";
import type { DeviceProvider, DeviceRegistry } from "@nexus/domain";
import type { PluginRegistry } from "@nexus/plugins-sdk";

import type { EventLog } from "./event-log";

export interface HttpServerDeps {
  readonly deviceRegistry: DeviceRegistry;
  readonly pluginRegistry: PluginRegistry;
  // Hoje só [windowsProvider] — array (não um único provider) porque o
  // bootstrap já sabe que outros providers (Docker, Home Assistant, Tuya...)
  // vão se somar a este sem precisar mexer aqui.
  readonly providers: readonly DeviceProvider[];
  readonly eventLog: EventLog;
}

const DEFAULT_EVENTS_LIMIT = 50;

/**
 * Servidor HTTP somente-leitura que expõe o estado do Core (plugin-host)
 * para outros processos — hoje só o Dashboard (apps/web, via Server
 * Component fazendo fetch Node→Node). node:http puro, no mesmo espírito do
 * WebSocketAgentGateway (packages/infrastructure): poucas rotas GET, não
 * vale a pena puxar um framework HTTP para isso.
 *
 * Sem CORS e sem autenticação, de propósito: nunca é chamado direto de um
 * browser. A mesma pendência de segurança do AgentGateway (ver
 * ARCHITECTURE.md, seção 11) se aplica aqui — não expor esta porta fora de
 * localhost/rede confiável antes de existir um mecanismo de autenticação.
 */
export function createHttpServer(deps: HttpServerDeps): http.Server {
  return http.createServer((req, res) => {
    try {
      handleRequest(deps, req, res);
    } catch (error) {
      // Qualquer erro não previsto (ex.: um provider/registry lançando na
      // hora de serializar) vira 500 em vez de derrubar o processo — este
      // servidor roda dentro do mesmo processo que o Core de verdade.
      respondJson(res, 500, { error: String(error) });
    }
  });
}

function handleRequest(deps: HttpServerDeps, req: IncomingMessage, res: ServerResponse): void {
  // req.url nunca inclui host — a base "http://localhost" é só para o
  // parser de URL funcionar, nunca é usada de verdade.
  const { pathname, searchParams } = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && pathname === "/health") {
    respondJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "GET" && pathname === "/devices") {
    respondJson(res, 200, deps.deviceRegistry.list().map(toDeviceDto));
    return;
  }

  if (req.method === "GET" && pathname === "/events") {
    respondJson(res, 200, deps.eventLog.list(parseLimit(searchParams)).map(toDeviceEventDto));
    return;
  }

  if (req.method === "GET" && pathname === "/plugins") {
    const plugins = deps.pluginRegistry.list().map((entry) => ({
      id: entry.plugin.manifest.id,
      name: entry.plugin.manifest.name,
      version: entry.plugin.manifest.version,
      state: entry.state,
    }));
    respondJson(res, 200, plugins);
    return;
  }

  if (req.method === "GET" && pathname === "/providers") {
    const providers = deps.providers.map((provider) => ({
      id: provider.descriptor.id,
      name: provider.descriptor.name,
      deviceCount: deps.deviceRegistry.listByProvider(provider.descriptor.id).length,
    }));
    respondJson(res, 200, providers);
    return;
  }

  respondJson(res, 404, { error: "not found" });
}

/** `?limit=N` inválido ou ausente cai no padrão em vez de virar erro — esta é uma rota de leitura despretensiosa, não vale a pena validar com rigor. */
function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  if (raw === null) {
    return DEFAULT_EVENTS_LIMIT;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_EVENTS_LIMIT;
}

function respondJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
