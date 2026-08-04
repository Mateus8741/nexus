import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";
import type {
  ApproveAgentUseCase,
  CreateApiKeyUseCase,
  CreateMembershipUseCase,
  CreateProviderAccountUseCase,
  CreateSpaceUseCase,
  ExecuteDeviceActionUseCase,
  ListAgentsUseCase,
  ListApiKeysUseCase,
  ListAuditLogsUseCase,
  ListPersistedEventsUseCase,
  ListProviderAccountsUseCase,
  ListRolesUseCase,
  ListSpacesUseCase,
  ListUsersUseCase,
  RevokeAgentUseCase,
  RevokeApiKeyUseCase,
  RotateAgentTokenUseCase,
} from "@nexus/application";
import { toDeviceDto, toDeviceEventDto } from "@nexus/application";
import type { NexusAuth } from "@nexus/auth";
import { attachOwnerMembership, countUsers } from "@nexus/auth";
import type { NexusDatabase } from "@nexus/db";
import type {
  ActorContext,
  AuditLog,
  CapabilityRegistry,
  DeviceEvent,
  DeviceProvider,
  DeviceRegistry,
  EventBus,
  PermissionService,
  RoleRepository,
  SpaceRepository,
  SystemEvent,
} from "@nexus/domain";
import { PermissionDeniedError } from "@nexus/domain";
import { generateAgentToken, generateApiKey } from "@nexus/infrastructure";
import type { PluginRegistry } from "@nexus/plugins-sdk";
import { toNodeHandler } from "better-auth/node";
import { z } from "zod";

import type { AgentPairingBridge } from "../agents/agent-pairing-bridge";
import { type ResolveActorDeps, resolveActor } from "../auth/resolve-actor";

export interface HttpServerDeps {
  readonly db: NexusDatabase;
  readonly auth: NexusAuth;
  readonly resolveActorDeps: ResolveActorDeps;
  readonly deviceRegistry: DeviceRegistry;
  readonly pluginRegistry: PluginRegistry;
  readonly providers: readonly DeviceProvider[];
  readonly auditLog: AuditLog;
  readonly capabilityRegistry: CapabilityRegistry;
  readonly executeDeviceAction: ExecuteDeviceActionUseCase;
  readonly permissionService: PermissionService;
  readonly eventBus: EventBus<SystemEvent>;
  readonly listUsers: ListUsersUseCase;
  readonly listRoles: ListRolesUseCase;
  readonly listAgents: ListAgentsUseCase;
  readonly listApiKeys: ListApiKeysUseCase;
  readonly listAudit: ListAuditLogsUseCase;
  readonly listEvents: ListPersistedEventsUseCase;
  readonly approveAgent: ApproveAgentUseCase;
  readonly revokeAgent: RevokeAgentUseCase;
  readonly rotateAgentToken: RotateAgentTokenUseCase;
  readonly createApiKey: CreateApiKeyUseCase;
  readonly revokeApiKey: RevokeApiKeyUseCase;
  readonly pairingBridge: AgentPairingBridge;
  readonly defaultWorkspaceId: string;
  readonly roles: RoleRepository;
  /**
   * Leitura direta (sem passar por permission gate) — usada só para
   * resolver o nome do Space do próprio ator em GET /me. Listar TODOS os
   * Spaces do workspace continua exigindo "workspace.manage" via
   * ListSpacesUseCase.
   */
  readonly spaces: SpaceRepository;
  readonly createSpace: CreateSpaceUseCase;
  readonly listSpaces: ListSpacesUseCase;
  readonly createMembership: CreateMembershipUseCase;
  readonly createProviderAccount: CreateProviderAccountUseCase;
  readonly listProviderAccounts: ListProviderAccountsUseCase;
}

const DEFAULT_EVENTS_LIMIT = 50;
const DEVICE_EVENT_PREFIX = "device.";
const ACTIONS_ROUTE_PATTERN = /^\/devices\/([^/]+)\/actions$/;

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  workspaceName: z.string().min(1).optional(),
});

const createApiKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
});

const createSpaceSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
});

const inviteUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  roleKey: z.string().min(1),
  spaceId: z.string().optional(),
});

const createProviderAccountSchema = z.object({
  spaceId: z.string().min(1),
  providerId: z.string().min(1),
  externalId: z.string().min(1),
  label: z.string().optional(),
});

export function createHttpServer(deps: HttpServerDeps): http.Server {
  const authHandler = toNodeHandler(deps.auth);

  return http.createServer((req, res) => {
    handleCors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    handleRequest(deps, authHandler, req, res).catch((error: unknown) => {
      if (error instanceof PermissionDeniedError) {
        respondJson(res, 403, { error: error.message });
        return;
      }
      deps.eventBus.publish({
        type: "internal.error",
        occurredAt: new Date(),
        message: String(error),
        source: "http",
      });
      respondJson(res, 500, { error: String(error) });
    });
  });
}

function handleCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
}

async function handleRequest(
  deps: HttpServerDeps,
  authHandler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const { pathname, searchParams } = new URL(req.url ?? "/", "http://localhost");

  if (pathname.startsWith("/api/auth")) {
    await authHandler(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/health") {
    respondJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "GET" && pathname === "/setup/status") {
    const users = await countUsers(deps.db);
    respondJson(res, 200, { needsSetup: users === 0 });
    return;
  }

  if (req.method === "POST" && pathname === "/setup") {
    await handleSetup(deps, req, res);
    return;
  }

  const actor = await resolveActor(deps.resolveActorDeps, req);
  if (!actor) {
    deps.eventBus.publish({
      type: "auth.failure",
      occurredAt: new Date(),
      reason: "unauthenticated",
      ip: req.socket.remoteAddress ?? undefined,
    });
    respondJson(res, 401, { error: "unauthenticated" });
    return;
  }

  if (req.method === "GET" && pathname === "/me") {
    const space = actor.spaceId ? await deps.spaces.get(actor.spaceId) : undefined;
    respondJson(res, 200, {
      actor: {
        type: actor.type,
        id: actor.id,
        workspaceId: actor.workspaceId,
        roleKey: actor.roleKey,
        spaceId: actor.spaceId,
        spaceName: space?.name,
      },
    });
    return;
  }

  if (req.method === "GET" && pathname === "/devices") {
    await deps.permissionService.require(actor, "device.read");
    // Ator restrito a um Space só enxerga dispositivos desse ambiente — ver
    // ActorContext.spaceId. Sem restrição (Owner hoje), enxerga tudo.
    const devices = actor.spaceId
      ? deps.deviceRegistry.list().filter((device) => device.spaceId === actor.spaceId)
      : deps.deviceRegistry.list();
    respondJson(res, 200, devices.map(toDeviceDto));
    return;
  }

  if (req.method === "GET" && pathname === "/events") {
    const persisted = await deps.listEvents.execute({
      actor,
      limit: parseLimit(searchParams),
      typePrefix: searchParams.get("prefix") ?? undefined,
    });
    respondJson(res, 200, persisted);
    return;
  }

  if (req.method === "GET" && pathname === "/events/device") {
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

  if (req.method === "GET" && pathname === "/users") {
    respondJson(res, 200, await deps.listUsers.execute({ actor }));
    return;
  }

  if (req.method === "GET" && pathname === "/roles") {
    respondJson(res, 200, await deps.listRoles.execute({ actor }));
    return;
  }

  if (req.method === "GET" && pathname === "/agents") {
    const status = searchParams.get("status") as "pending" | "approved" | "revoked" | null;
    respondJson(
      res,
      200,
      await deps.listAgents.execute({
        actor,
        status: status ?? undefined,
      }),
    );
    return;
  }

  if (req.method === "GET" && pathname === "/agents/pending") {
    respondJson(res, 200, await deps.listAgents.execute({ actor, status: "pending" }));
    return;
  }

  if (req.method === "POST" && pathname.match(/^\/agents\/([^/]+)\/approve$/)) {
    const agentId = pathname.split("/")[2] as string;
    await handleApproveAgent(deps, actor, agentId, res);
    return;
  }

  if (req.method === "POST" && pathname.match(/^\/agents\/([^/]+)\/revoke$/)) {
    const agentId = pathname.split("/")[2] as string;
    await deps.revokeAgent.execute({ actor, agentId });
    deps.pairingBridge.disconnectAgent(agentId);
    respondJson(res, 200, { success: true });
    return;
  }

  if (req.method === "POST" && pathname.match(/^\/agents\/([^/]+)\/rotate-token$/)) {
    const agentId = pathname.split("/")[2] as string;
    const { token, hash } = generateAgentToken();
    await deps.rotateAgentToken.execute({ actor, agentId, newTokenHash: hash });
    deps.pairingBridge.deliverApprovalToken(agentId, token);
    respondJson(res, 200, { token });
    return;
  }

  if (req.method === "GET" && pathname === "/api-keys") {
    const keys = await deps.listApiKeys.execute({ actor });
    respondJson(
      res,
      200,
      keys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        revokedAt: key.revokedAt,
      })),
    );
    return;
  }

  if (req.method === "POST" && pathname === "/api-keys") {
    await handleCreateApiKey(deps, actor, req, res);
    return;
  }

  if (req.method === "DELETE" && pathname.match(/^\/api-keys\/([^/]+)$/)) {
    const apiKeyId = pathname.split("/")[2] as string;
    await deps.revokeApiKey.execute({ actor, apiKeyId });
    respondJson(res, 200, { success: true });
    return;
  }

  if (req.method === "GET" && pathname === "/audit") {
    respondJson(res, 200, await deps.listAudit.execute({ actor, limit: parseLimit(searchParams) }));
    return;
  }

  if (req.method === "GET" && pathname === "/sessions") {
    const { fromNodeHeaders } = await import("better-auth/node");
    const session = await deps.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    respondJson(res, 200, session ? [session.session] : []);
    return;
  }

  if (req.method === "GET" && pathname === "/spaces") {
    respondJson(res, 200, await deps.listSpaces.execute({ actor }));
    return;
  }

  if (req.method === "POST" && pathname === "/spaces") {
    await handleCreateSpace(deps, actor, req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/users/invite") {
    await handleInviteUser(deps, actor, req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/provider-accounts") {
    respondJson(res, 200, await deps.listProviderAccounts.execute({ actor }));
    return;
  }

  if (req.method === "POST" && pathname === "/provider-accounts") {
    await handleCreateProviderAccount(deps, actor, req, res);
    return;
  }

  const actionsMatch = req.method === "POST" ? pathname.match(ACTIONS_ROUTE_PATTERN) : null;
  if (actionsMatch) {
    const deviceId = actionsMatch[1] as string;
    await handleExecuteDeviceAction(deps, actor, req, res, deviceId);
    return;
  }

  respondJson(res, 404, { error: "not found" });
}

async function handleSetup(
  deps: HttpServerDeps,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const users = await countUsers(deps.db);
  if (users > 0) {
    respondJson(res, 409, { error: "Setup já concluído." });
    return;
  }

  const body = setupSchema.safeParse(JSON.parse((await readRequestBody(req)) || "{}"));
  if (!body.success) {
    respondJson(res, 400, { error: body.error.flatten() });
    return;
  }

  const result = await deps.auth.api.signUpEmail({
    body: {
      email: body.data.email,
      password: body.data.password,
      name: body.data.name,
    },
  });

  if (!result.user) {
    respondJson(res, 500, { error: "Falha ao criar usuário Owner." });
    return;
  }

  await attachOwnerMembership(deps.db, result.user.id, body.data.workspaceName);

  deps.eventBus.publish({
    type: "auth.login",
    occurredAt: new Date(),
    userId: result.user.id,
    ip: req.socket.remoteAddress ?? undefined,
  });

  respondJson(res, 201, { userId: result.user.id, email: result.user.email });
}

async function handleApproveAgent(
  deps: HttpServerDeps,
  actor: ActorContext,
  agentId: string,
  res: ServerResponse,
): Promise<void> {
  const { token, hash } = generateAgentToken();
  await deps.approveAgent.execute({ actor, agentId, tokenHash: hash });
  const delivered = deps.pairingBridge.deliverApprovalToken(agentId, token);
  respondJson(res, 200, { token, deliveredToAgent: delivered });
}

async function handleCreateApiKey(
  deps: HttpServerDeps,
  actor: ActorContext,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const parsed = createApiKeySchema.safeParse(JSON.parse((await readRequestBody(req)) || "{}"));
  if (!parsed.success) {
    respondJson(res, 400, { error: parsed.error.flatten() });
    return;
  }
  const generated = generateApiKey();
  const apiKey = await deps.createApiKey.execute({
    actor,
    name: parsed.data.name,
    keyHash: generated.hash,
    prefix: generated.prefix,
    scopes: parsed.data.scopes,
  });
  respondJson(res, 201, {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    scopes: apiKey.scopes,
    token: generated.token,
  });
}

async function handleCreateSpace(
  deps: HttpServerDeps,
  actor: ActorContext,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const parsed = createSpaceSchema.safeParse(JSON.parse((await readRequestBody(req)) || "{}"));
  if (!parsed.success) {
    respondJson(res, 400, { error: parsed.error.flatten() });
    return;
  }
  const space = await deps.createSpace.execute({
    actor,
    name: parsed.data.name,
    parentId: parsed.data.parentId,
  });
  respondJson(res, 201, space);
}

/**
 * Convite de usuário: cria a conta via Better Auth (não tem membership
 * própria — @nexus/application não pode depender do Better Auth, ver
 * handleSetup acima para o mesmo padrão) e então vincula ao workspace com um
 * papel e, opcionalmente, um Space via CreateMembershipUseCase (que já exige
 * a permissão "user.manage" do ator que está convidando).
 */
async function handleInviteUser(
  deps: HttpServerDeps,
  actor: ActorContext,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const parsed = inviteUserSchema.safeParse(JSON.parse((await readRequestBody(req)) || "{}"));
  if (!parsed.success) {
    respondJson(res, 400, { error: parsed.error.flatten() });
    return;
  }

  const role = await deps.roles.getByKey(actor.workspaceId, parsed.data.roleKey);
  if (!role) {
    respondJson(res, 400, { error: `Papel "${parsed.data.roleKey}" não encontrado.` });
    return;
  }

  const result = await deps.auth.api.signUpEmail({
    body: {
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
    },
  });
  if (!result.user) {
    respondJson(res, 500, { error: "Falha ao criar usuário." });
    return;
  }

  const membership = await deps.createMembership.execute({
    actor,
    userId: result.user.id,
    roleId: role.id,
    spaceId: parsed.data.spaceId,
  });

  respondJson(res, 201, { userId: result.user.id, email: result.user.email, membership });
}

async function handleCreateProviderAccount(
  deps: HttpServerDeps,
  actor: ActorContext,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const parsed = createProviderAccountSchema.safeParse(
    JSON.parse((await readRequestBody(req)) || "{}"),
  );
  if (!parsed.success) {
    respondJson(res, 400, { error: parsed.error.flatten() });
    return;
  }
  const account = await deps.createProviderAccount.execute({
    actor,
    spaceId: parsed.data.spaceId,
    providerId: parsed.data.providerId,
    externalId: parsed.data.externalId,
    label: parsed.data.label,
  });
  respondJson(res, 201, account);
}

async function handleExecuteDeviceAction(
  deps: HttpServerDeps,
  actor: ActorContext,
  req: IncomingMessage,
  res: ServerResponse,
  deviceId: string,
): Promise<void> {
  let body: { action?: { type?: unknown; payload?: Record<string, unknown> } };
  try {
    const raw = await readRequestBody(req);
    body = raw.length > 0 ? (JSON.parse(raw) as typeof body) : {};
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
    actor,
  });
  respondJson(res, result.success ? 200 : 403, result);
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  if (raw === null) return DEFAULT_EVENTS_LIMIT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_EVENTS_LIMIT;
}

function respondJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
