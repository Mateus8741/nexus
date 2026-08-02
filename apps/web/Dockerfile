# syntax=docker/dockerfile:1
#
# Build context DEVE ser a raiz do monorepo (não apps/web) — precisa
# enxergar packages/* para o `turbo prune` funcionar. No Coolify: "Base
# Directory" = raiz do repo, "Dockerfile Location" = apps/web/Dockerfile.

FROM oven/bun:1 AS base
WORKDIR /app

# ---- 1. Poda o monorepo só ao que @nexus/web realmente usa ----
FROM base AS pruner
COPY . .
RUN bunx turbo prune @nexus/web --docker

# ---- 2. Instala dependências (camada cacheável: só invalida se mudar package.json/lockfile) ----
FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile

# ---- 3. Copia o código-fonte de verdade por cima e builda ----
FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN bun run build --filter=@nexus/web

# ---- 4. Runtime: só o output "standalone" do Next.js (ver next.config.ts) ----
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# NEXUS_PLUGIN_HOST_URL é lido em runtime (fetch por request, não no build) —
# configure como variável de ambiente no Coolify, não aqui.
ENV PORT=3000
EXPOSE 3000

CMD ["bun", "apps/web/server.js"]
