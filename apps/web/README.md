# @nexus/web

App Next.js (App Router) — a interface do Nexus. Parte do monorepo Turborepo; veja o `README.md` na raiz para visão geral da arquitetura.

## Desenvolvimento

Rode os comandos a partir da raiz do monorepo:

```bash
bun install
bun run dev        # roda todos os apps via turbo
bun --filter @nexus/web dev   # roda só o apps/web
```

## Adicionando componentes shadcn/ui

```bash
cd apps/web
bunx shadcn@latest add button
```

O CLI detecta o monorepo e instala o componente em `packages/ui`, ajustando os imports automaticamente.

## Variáveis de ambiente

- `NEXUS_PLUGIN_HOST_URL` — URL do `apps/plugin-host` (Core) que este Dashboard consome via fetch server-side (`lib/nexus-client.ts`). Padrão `http://localhost:4700` para desenvolvimento local; em produção (ver deploy abaixo), a URL pública do Core (ex.: `https://core.seudominio.com`).

## Deploy em produção

Ver `Dockerfile` neste diretório e ARCHITECTURE.md seção 16 (deploy no Coolify) — build context deve ser a raiz do monorepo, não `apps/web`.
