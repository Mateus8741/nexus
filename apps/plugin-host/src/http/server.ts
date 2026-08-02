import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";
import type { ExecuteDeviceActionUseCase } from "@nexus/application";
import { toDeviceDto, toDeviceEventDto } from "@nexus/application";
import type {
  AuditLog,
  CapabilityRegistry,
  DeviceEvent,
  DeviceProvider,
  DeviceRegistry,
} from "@nexus/domain";
import type { PluginRegistry } from "@nexus/plugins-sdk";

export interface HttpServerDeps {
  readonly deviceRegistry: DeviceRegistry;
  readonly pluginRegistry: PluginRegistry;
  // Hoje só [windowsProvider] — array (não um único provider) porque o
  // bootstrap já sabe que outros providers (Docker, Home Assistant, Tuya...)
  // vão se somar a este sem precisar mexer aqui.
  readonly providers: readonly DeviceProvider[];
  readonly auditLog: AuditLog;
  readonly capabilityRegistry: CapabilityRegistry;
  readonly executeDeviceAction: ExecuteDeviceActionUseCase;
}

const DEFAULT_EVENTS_LIMIT = 50;

// Nenhum outro SystemEvent hoje começa com "device." — checar o prefixo do
// `type` é suficiente para filtrar AuditEntry[] de volta para DeviceEvent[]
// sem precisar importar a lista de tipos de @nexus/domain.
const DEVICE_EVENT_PREFIX = "device.";

const ACTIONS_ROUTE_PATTERN = /^\/devices\/([^/]+)\/actions$/;

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
    handleRequest(deps, req, res).catch((error: unknown) => {
      // Qualquer erro não previsto (ex.: um provider/registry lançando na
      // hora de serializar) vira 500 em vez de derrubar o processo — este
      // servidor roda dentro do mesmo processo que o Core de verdade.
      respondJson(res, 500, { error: String(error) });
    });
  });
}

async function handleRequest(
  deps: HttpServerDeps,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
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
    const deviceEvents = deps.auditLog
      .list(parseLimit(searchParams))
      .map((entry) => entry.event)
      .filter((event): event is DeviceEvent => event.type.startsWith(DEVICE_EVENT_PREFIX));
    respondJson(res, 200, deviceEvents.map(toDeviceEventDto));
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

  if (req.method === "GET" && pathname === "/capabilities") {
    respondJson(res, 200, deps.capabilityRegistry.list());
    return;
  }

  const actionsMatch = req.method === "POST" ? pathname.match(ACTIONS_ROUTE_PATTERN) : null;
  if (actionsMatch) {
    const deviceId = actionsMatch[1] as string;
    await handleExecuteDeviceAction(deps, req, res, deviceId);
    return;
  }

  respondJson(res, 404, { error: "not found" });
}

interface ExecuteActionRequestBody {
  readonly action?: {
    readonly type?: unknown;
    readonly payload?: Record<string, unknown>;
  };
}

/** Só valida o mínimo (JSON parseável, `action.type` string) — o resto (se a ação existe/faz sentido para o dispositivo) é responsabilidade do provider, via ExecuteDeviceActionUseCase. */
async function handleExecuteDeviceAction(
  deps: HttpServerDeps,
  req: IncomingMessage,
  res: ServerResponse,
  deviceId: string,
): Promise<void> {
  let body: ExecuteActionRequestBody;
  try {
    const raw = await readRequestBody(req);
    body = raw.length > 0 ? (JSON.parse(raw) as ExecuteActionRequestBody) : {};
  } catch {
    respondJson(res, 400, { error: "Corpo da requisição não é um JSON válido." });
    return;
  }

  const action = body.action;
  if (
    typeof action !== "object" ||
    action === null ||
    typeof action.type !== "string" ||
    action.type.length === 0
  ) {
    respondJson(res, 400, { error: "Corpo inválido: esperado { action: { type: string } }." });
    return;
  }

  const result = await deps.executeDeviceAction.execute({
    deviceId,
    action: { type: action.type, payload: action.payload },
  });
  respondJson(res, 200, result);
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
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
