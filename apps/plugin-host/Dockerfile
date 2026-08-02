# syntax=docker/dockerfile:1
#
# Build context DEVE ser a raiz do monorepo (não apps/plugin-host) — precisa
# enxergar packages/* para o `turbo prune` funcionar. No Coolify: "Base
# Directory" = raiz do repo, "Dockerfile Location" = apps/plugin-host/Dockerfile.
#
# Sem etapa de build: Bun executa TypeScript diretamente (mesmo princípio de
# apps/agent-windows), então a imagem final só precisa do runtime + node_modules
# + o código-fonte já podado pelo turbo prune.

FROM oven/bun:1 AS base
WORKDIR /app

# ---- 1. Poda o monorepo só ao que @nexus/plugin-host realmente usa ----
FROM base AS pruner
COPY . .
RUN bunx turbo prune @nexus/plugin-host --docker

# ---- 2. Instala dependências (camada cacheável) + copia o código-fonte ----
FROM base AS runner
ENV NODE_ENV=production

COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .

# PORT e NEXUS_HTTP_PORT são lidos em runtime — configure como variável de
# ambiente no Coolify se precisar de um valor diferente de 4700. HTTP (API do
# Dashboard) e WebSocket (Agents remotos, ex.: apps/agent-windows) rodam na
# MESMA porta (ver src/index.ts) — só uma porta para o Coolify expor/mapear.
ENV PORT=4700
EXPOSE 4700

CMD ["bun", "run", "apps/plugin-host/src/index.ts"]
