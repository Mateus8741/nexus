# Nexus

Plataforma para gerenciamento de ambientes conectados. Ver `PROJECT.md` para a visão de produto e `ARCHITECTURE.md` para as decisões de arquitetura desta estrutura inicial.

Monorepo gerenciado com [Bun workspaces](https://bun.sh/docs/install/workspaces) + [Turborepo](https://turborepo.com).

## Estrutura

```
apps/
  web/            # Next.js — Dashboard autenticado
  plugin-host/    # Core (HTTP + WebSocket + Better Auth)
  agent-windows/  # Agent remoto Windows
packages/
  domain/         # Camada de Domínio
  application/    # Camada de Aplicação
  infrastructure/ # Camada de Infraestrutura
  db/             # Drizzle schema + Postgres client
  auth/           # Better Auth + bootstrap RBAC
  agent-protocol/ # protocolo Agent ↔ Core
  plugins-sdk/    # contrato público que todo plugin implementa
  plugins/        # pacotes de plugin (packages/plugins/<nome>)
  ui/             # design system compartilhado (shadcn/ui)
  typescript-config/
```

## Persistência / Auth

Ver `.env.example` e `ARCHITECTURE.md` §19.

```bash
docker compose up -d   # Postgres
bun run db:push        # schema
bun run dev            # web + plugin-host
# Abra /setup → crie Owner → /login
```

## Comandos

Rodar a partir da raiz:

```bash
bun install          # instala tudo
bun run dev          # roda todos os apps em dev (via turbo)
bun run build        # builda tudo
bun run typecheck    # tsc --noEmit em cada pacote
bun run lint         # eslint (regras Next) em apps/web
bun run check        # biome check --write . (lint + format + organize imports)
bun run format:docs  # prettier em arquivos .md/.mdx
bun run db:push      # aplica schema Drizzle no Postgres
bun run db:generate  # gera migrations
```

Para rodar um único workspace: `bun run --filter @nexus/web dev`.
