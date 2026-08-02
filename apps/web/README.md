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
