import type { IncomingMessage } from "node:http";
import type { NexusAuth } from "@nexus/auth";
import type {
  ActorContext,
  ApiKeyRepository,
  EventBus,
  MembershipRepository,
  SystemEvent,
} from "@nexus/domain";
import { hashToken, isApiKey } from "@nexus/infrastructure";
import { fromNodeHeaders } from "better-auth/node";

export interface ResolveActorDeps {
  readonly auth: NexusAuth;
  readonly memberships: MembershipRepository;
  readonly apiKeys: ApiKeyRepository;
  readonly eventBus: EventBus<SystemEvent>;
  readonly defaultWorkspaceId: string;
}

function getBearer(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim();
}

/**
 * Resolve o Actor a partir de sessão Better Auth (cookie) ou API Key (Bearer nxk_).
 */
export async function resolveActor(
  deps: ResolveActorDeps,
  req: IncomingMessage,
): Promise<ActorContext | null> {
  const ip = req.socket.remoteAddress ?? undefined;
  const bearer = getBearer(req);

  if (bearer && isApiKey(bearer)) {
    const apiKey = await deps.apiKeys.findByKeyHash(hashToken(bearer));
    if (!apiKey || apiKey.revokedAt) {
      deps.eventBus.publish({
        type: "auth.failure",
        occurredAt: new Date(),
        reason: "invalid_api_key",
        ip,
      });
      return null;
    }
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      deps.eventBus.publish({
        type: "auth.failure",
        occurredAt: new Date(),
        reason: "expired_api_key",
        ip,
      });
      return null;
    }
    void deps.apiKeys.touchLastUsed(apiKey.id, new Date());
    return {
      type: "api_key",
      id: apiKey.id,
      workspaceId: apiKey.workspaceId,
      permissions: apiKey.scopes,
      ip,
    };
  }

  try {
    const session = await deps.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) return null;

    const memberships = await deps.memberships.listByUser(session.user.id);
    const membership =
      memberships.find((m) => m.workspaceId === deps.defaultWorkspaceId) ?? memberships[0];
    if (!membership) return null;

    return {
      type: "user",
      id: session.user.id,
      workspaceId: membership.workspaceId,
      roleKey: membership.roleKey,
      ip,
      userAgent:
        typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    };
  } catch {
    return null;
  }
}
