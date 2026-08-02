# Nexus

Plataforma para gerenciamento de ambientes conectados. Ver `PROJECT.md` para a visão de produto e `ARCHITECTURE.md` para as decisões de arquitetura desta estrutura inicial.

Monorepo gerenciado com [Bun workspaces](https://bun.sh/docs/install/workspaces) + [Turborepo](https://turborepo.com).

## Estrutura

```
apps/
  web/            # Next.js — interface do Nexus
  plugin-host/    # processo Node de longa duração que executa plugins
packages/
  domain/         # Camada de Domínio
  application/    # Camada de Aplicação
  infrastructure/ # Camada de Infraestrutura
  plugins-sdk/    # contrato público que todo plugin implementa
  plugins/        # convenção para pacotes de plugin (packages/plugins/<nome>)
  ui/             # design system compartilhado (shadcn/ui)
  typescript-config/ # tsconfig base compartilhado
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
```

Para rodar um único workspace: `bun run --filter @nexus/web dev`.

## Nenhuma funcionalidade implementada

Este é o estado inicial do projeto: apenas estrutura de pastas e ferramentas configuradas (aliases, ESLint, Prettier, Biome, shadcn, camadas Domain/Application/Infrastructure, convenção de plugins). Nenhuma regra de negócio existe ainda.
