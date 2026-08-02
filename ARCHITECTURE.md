# Arquitetura — Estrutura Inicial

Este documento explica as decisões tomadas ao montar o esqueleto do projeto. Nenhuma funcionalidade foi implementada — só pastas, configs e convenções.

## 1. Monorepo (Turborepo + Bun workspaces)

O `PROJECT.md` deixa claro que o Nexus não é "um app Next.js": é um sistema operacional para ambientes, com um núcleo web e, no mínimo, um processo separado para rodar integrações (MQTT, varredura de rede, watchers de Docker/Proxmox/Home Assistant) que precisam manter conexões e estado vivos — algo que não cabe no modelo serverless/route-handler do Next.js.

Por isso a raiz não é mais um único `package.json` de app Next.js: é um monorepo com dois tipos de workspace:

- `apps/*` — coisas que rodam (processos): hoje `web` (Next.js) e `plugin-host` (Node de longa duração).
- `packages/*` — código compartilhado entre apps, sem processo próprio.

Ferramentas escolhidas:

- **Bun workspaces** para instalar dependências e linkar os pacotes internos (`workspace:*`) — já era o package manager em uso (`bun.lock` existente).
- **Turborepo** para orquestrar `dev`/`build`/`lint`/`typecheck` entre os workspaces com cache e paralelismo, sem precisar rodar comando por comando em cada pasta.

## 2. Camadas Domain / Application / Infrastructure

Implementadas como **pacotes separados** (`@nexus/domain`, `@nexus/application`, `@nexus/infrastructure`), não como pastas dentro de um único app. Isso torna a regra de dependência da Clean Architecture impossível de violar por acidente — se `@nexus/domain` tentar importar `@nexus/infrastructure`, o TypeScript/bundler acusa erro de resolução, porque essa dependência nunca foi declarada no `package.json`.

Regra de dependência (uma via só):

```
domain  ←  application  ←  infrastructure  ←  apps (web, plugin-host)
```

- **`@nexus/domain`**: entidades, objetos de valor, interfaces de repositório (ports) e eventos de domínio. Não depende de nada — nem de framework, nem das outras camadas.
- **`@nexus/application`**: casos de uso que orquestram o domínio. Define os _ports_ que espera da infraestrutura (`EventBus`, `Clock`, etc.), mas nunca importa a implementação concreta.
- **`@nexus/infrastructure`**: implementações reais (banco, mensageria, adaptadores para Docker/Proxmox/Home Assistant/etc.). É a única camada autorizada a depender de bibliotecas externas.

Cada pacote tem seu próprio `package.json` + `tsconfig.json`, mas nenhum código de verdade — só um `src/index.ts` com um comentário explicando a responsabilidade da camada e subpastas convencionais (`entities/`, `use-cases/`, `adapters/`, etc.) com um `README.md` cada, documentando o que deve entrar ali.

## 3. Estrutura de plugins

Dividida em duas partes:

- **`@nexus/plugins-sdk`**: o contrato público. Define a interface que qualquer plugin deve implementar, o ciclo de vida (instalar/iniciar/parar/remover) e o schema de manifesto/capacidades — além do Registry e do Loader que o host usa para gerenciá-los (implementação e decisões de desacoplamento na seção 8). É o "kernel API" — nenhum plugin, nem os de primeira parte, tem acesso a nada além do que está exposto aqui. É isso que garante a exigência do `PROJECT.md` de que "nenhum fabricante possui tratamento especial".
- **`packages/plugins/`**: convenção documentada (ver `packages/plugins/README.md`) para onde cada plugin (`@nexus/plugin-mqtt`, `@nexus/plugin-docker`, etc.) deve morar como pacote próprio do workspace, dependendo só de `@nexus/plugins-sdk`. Nenhum plugin foi criado ainda.
- **`apps/plugin-host`**: o processo que descobre, carrega e executa esses pacotes em runtime. Existe separado de `apps/web` justamente porque integrações contínuas não cabem em route handlers.

## 4. Aliases

Dois níveis, resolvidos de formas diferentes:

- **Dentro de um workspace** (ex.: `apps/web`): alias local `@/*` → raiz do próprio app (`tsconfig.json` → `paths`). Usado pelos aliases do shadcn (`@/components`, `@/hooks`, `@/lib`).
- **Entre workspaces** (ex.: `apps/web` importando `@nexus/domain`): não usa `tsconfig paths` — usa o nome real do pacote (`@nexus/domain`, `@nexus/ui`, etc.), resolvido pelo Bun via symlink em `node_modules`. Cada pacote expõe seu `src/index.ts` diretamente via `main`/`types`/`exports` no `package.json` — sem etapa de build própria. O Next.js precisa ser avisado disso: `apps/web/next.config.ts` declara `transpilePackages` para que ele transpile o TypeScript "cru" desses pacotes.

Isso evita o padrão comum (e frágil) de mapear `@nexus/domain` via `tsconfig paths` apontando para um caminho relativo — o pacote é resolvido como uma dependência de verdade.

## 5. Biome + ESLint + Prettier (sem sobreposição)

As três ferramentas foram pedidas, mas se sobrepõem (Biome já formata e linta JS/TS/JSON/CSS). Divisão de responsabilidade, sem regras conflitantes:

- **Biome** (`biome.json` na raiz, cobre o monorepo inteiro): formatação e lint geral de TS/TSX/JS/JSON/CSS, e organização de imports (`assist.actions.source.organizeImports`). Roda uma vez só, na raiz — não precisa de config por pacote.
- **ESLint** (`apps/web/eslint.config.mjs`): só `eslint-config-next` (`core-web-vitals` + `typescript`) — as regras específicas do App Router/React que o Biome ainda não cobre. Sem regras de formatação — isso é 100% do Biome.
- **Prettier** (`.prettierrc.json` + `.prettierignore` na raiz): restrito a `.md`/`.mdx` — o Biome não formata Markdown. Todo o resto do repositório está no `.prettierignore`.

Comandos: `bun run check` (Biome, com fix), `bun run lint` (ESLint via turbo, só em `apps/web`), `bun run format:docs` (Prettier em Markdown).

## 6. shadcn/ui em monorepo

Seguido o padrão oficial de monorepo do shadcn/ui (`ui.shadcn.com/docs/monorepo`): um pacote `@nexus/ui` guarda os componentes, `lib/utils.ts` (`cn`) e o `globals.css` com os tokens de tema (Tailwind v4, CSS-first, sem `tailwind.config.js`). `apps/web` tem seu próprio `components.json` apontando os aliases `ui`/`utils` para `@nexus/ui`, então rodar `bunx shadcn add <componente>` dentro de `apps/web` instala o componente no lugar certo (`packages/ui`) e já ajusta os imports.

Nenhum componente foi adicionado ainda — só a configuração (`components.json` nos dois workspaces, `lib/utils.ts`, tokens de tema em `globals.css`). `apps/web/app/globals.css` só importa `@nexus/ui/globals.css`, para o tema ter uma única fonte de verdade.

## 7. Layout (Sidebar, Topbar, área central)

`apps/web/components/layout/` implementa o shell visual: `app-shell.tsx` (composição), `sidebar.tsx` (desktop, colapsável), `mobile-sidebar.tsx` (drawer CSS puro, sem Dialog), `topbar.tsx` e `nav-items.ts`. Tema forçado dark (`className="dark"` no `<html>`, sem toggle). Seis primitivas shadcn/ui (`button`, `separator`, `tooltip`, `scroll-area`, `avatar`, `input`, estilo `base-nova` sobre `@base-ui/react`) foram portadas manualmente para `packages/ui/src/components` a partir do registry oficial, porque o `bunx shadcn add` não tem acesso de rede neste ambiente de desenvolvimento. Só "Dashboard" aponta para uma rota real; o resto da navegação usa `href="#"` com estilo desabilitado, porque nenhuma página além da inicial foi implementada.

## 8. Sistema de Plugins (`@nexus/plugins-sdk`)

Implementado como cinco peças **desacopladas** dentro de um único pacote — decoupled entre si (cada uma pode ser usada/testada sem as outras), não decoupled do pacote (não há motivo para serem pacotes npm separados, já que sempre evoluem juntas como uma única API pública versionada):

- **Plugin Manifest** (`src/contracts/manifest.ts`): `PluginManifest` (id, nome, versão, `capabilities[]`, `engines.nexus`) + `isPluginManifest`/`assertPluginManifest`, validação em runtime porque um manifesto vem de fora do type-checker (de um `plugin.manifest.json` real, eventualmente). `PluginCapability` é uma união de strings genéricas (`device-adapter`, `network-discovery`, etc.) — de novo, sem menção a fabricante específico.
- **Plugin Interface** (`src/contracts/plugin.ts`): a interface `Plugin` (`manifest`, `onStart`, `onStop` obrigatórios; `onInstall`/`onUninstall` opcionais) + `isPlugin`, o type guard que o Loader usa para validar a forma de um candidato antes de confiar nele.
- **Plugin Context** (`src/contracts/context.ts`): `PluginContext` — a única coisa que um plugin recebe nos hooks de lifecycle (logger + config). Não dá acesso a `@nexus/infrastructure`, ao filesystem, nem a outros plugins.
- **Plugin Registry** (`src/registry.ts`): `PluginRegistry` guarda os plugins conhecidos em memória (`Map`) e o estado de cada um, validando transições contra `src/lifecycle/state.ts` (`registered → starting → started → stopping → stopped`, com `error` alcançável de qualquer estado). Não sabe nada sobre como um plugin foi carregado.
- **Plugin Loader** (`src/loader.ts`): `PluginLoader` recebe um `PluginRegistry` no construtor e um `PluginSource` em `loadAll()` — uma interface com um único método `discover()`. O Loader valida cada candidato (manifest + interface) e registra os válidos; um candidato malformado vira uma entrada em `rejected`, não uma exceção que derruba o carregamento dos demais.

A decisão chave de desacoplamento: **o Loader não sabe onde os plugins vivem.** Descobrir plugins em `packages/plugins/*` via filesystem é trabalho do host (`apps/plugin-host`, ainda não implementado) implementando um `PluginSource` — o Loader só recebe candidatos já resolvidos. Isso torna o SDK inteiro testável sem tocar disco: um `PluginSource` fake bastou para validar Registry + Loader + Manifest + Interface compostos (ver seção 9).

Removida a dependência (não usada) de `@nexus/domain` que o `package.json` do `plugins-sdk` tinha desde a estrutura inicial — o SDK agora não depende de nenhum outro pacote do monorepo, só de si mesmo.

Nenhum plugin foi implementado — só o SDK que eles vão consumir. `apps/plugin-host` continua sendo apenas um esqueleto; ligar `PluginRegistry`/`PluginLoader` a uma descoberta real em filesystem fica para um próximo passo.

## 9. Sistema de Dispositivos (`@nexus/domain`)

Primeiro conteúdo real de `@nexus/domain` (até aqui só tinha comentários). Diferente do sistema de plugins (interfaces + uma engine concreta), aqui o pedido foi explicitamente **só abstrações** — nenhuma classe, nenhuma função, zero código em runtime. Todo arquivo abaixo compila para JS vazio; só existem para o type-checker.

- **Device** (`entities/device.ts`): a entidade — `id` interno do Nexus, `providerId`, `externalId` (opaco, do fabricante/protocolo), `kind` genérico (`"light"`, `"sensor"`, `"server"`...), `capabilities[]` e o `state` atual. `spaceId` já existe como campo (tipado `string`) mesmo sem a entidade Espaço/Ambiente implementada ainda.
- **DeviceState** (`value-objects/device-state.ts`): snapshot imutável — `status` de conectividade (`online`/`offline`/`unknown`, deliberadamente separado do atributo "ligado/desligado" de um dispositivo) + `attributes` livre (`Record<string, string | number | boolean | null>`) + `observedAt`.
- **DeviceAction** (`value-objects/device-action.ts`): comando abstrato (`type` + `payload` livres — o vocabulário de ações válidas é decisão de cada provider, via `DeviceCapability.actions`) e `DeviceActionResult`.
- **DeviceEvent** (`events/device-event.ts`): união discriminada (`device.connected`, `device.disconnected`, `device.state-changed`, `device.action-executed`, `device.error`) em vez de um único tipo genérico com `payload: unknown` — cada variante carrega exatamente os dados daquele evento.
- **DeviceProvider** (`repositories/device-provider.ts`): o port que uma integração concreta implementaria (`listDevices`, `getState`, `executeAction`, `subscribe`). Só a interface — nenhum "Windows", "Tuya" ou "Docker" existe neste pacote; essas implementações são trabalho futuro de `@nexus/infrastructure/adapters` ou de um pacote em `packages/plugins/*`.
- **DeviceRegistry** (`registries/device-registry.ts`, pasta nova): contrato de quem agrega e rastreia dispositivos de múltiplos providers em memória. Ao contrário do `PluginRegistry` do sistema de plugins (uma classe concreta), aqui ficou só a interface — o pedido foi explícito ("apenas as interfaces"). Criei a pasta `registries/` porque esse padrão (rastrear entidades vivas + emitir eventos) é diferente de `repositories/` (persistir/consultar) e vai se repetir (ex.: um futuro `SpaceRegistry`).

Nenhuma das seis peças depende de framework, de outro pacote do monorepo, nem de detalhes de protocolo/fabricante — só umas das outras dentro de `@nexus/domain`, o que já era a regra da camada desde a estrutura inicial.

## 10. Dashboard (dados mockados)

Primeira página real de `apps/web`, substituindo o placeholder. Objetivo explícito era só validar a interface visual — nenhuma API, nenhum `DeviceProvider`/`DeviceRegistry` real por trás.

- **Dados mockados moldados pelos tipos reais** (`apps/web/lib/mocks/{devices,events,activity-series}.ts`): os mocks usam `Device`/`DeviceState`/`DeviceEvent` de `@nexus/domain` diretamente, em vez de formas ad-hoc. Isso já serve como mais um teste de composição dos tipos do sistema de Dispositivos (seção 9), com dados de exemplo em vez de um script descartável.
- **`apps/web/lib/mocks/environments.ts`**: um lookup local só com `{ id, name }`, porque `@nexus/domain` ainda não tem a entidade Espaço/Ambiente — o Dashboard precisa agrupar dispositivos por ambiente de algum jeito.
- **Determinismo nos mocks**: `activity-series.ts` gera os 24 pontos do gráfico com uma fórmula fixa (sem `Math.random()`), evitando qualquer risco de mismatch entre o que o servidor renderiza e o que o cliente hidrata.
- **Componentes** (`apps/web/components/dashboard/`): `stat-card`, `device-table`, `event-feed`, `environment-overview` (Server Components — nenhum estado de cliente necessário) e `activity-chart` (o único Client Component da página, porque `recharts` precisa do browser). `event-feed.tsx` usa um `switch` exaustivo sobre a união discriminada `DeviceEvent` para descrever cada evento, com checagem `never` no `default`.
- **Honestidade dos números**: dispositivos e ambientes mostram contagens mockadas reais (porque o sistema de Dispositivos existe de verdade); automações e plugins mostram "0" com uma dica explicando que esses sistemas ainda não têm implementação — para não sugerir que algo funciona quando não funciona.
- **`recharts`** foi adicionado como dependência real de `apps/web` (não é um componente shadcn) para o gráfico de atividade, estilizado com as variáveis de tema de `@nexus/ui` (`var(--color-primary)`, etc.) em vez de cores fixas.

## 11. O que foi validado

Rodado neste ambiente antes de cada entrega: `bun install`, `bun run typecheck` (tsc --noEmit em todos os pacotes), `bun run lint` (ESLint em `apps/web`) e `bun run check` (Biome) — todos passando sem erro.

Para o sistema de plugins: um script descartável (não commitado) exercitou `PluginRegistry` + `PluginLoader` + `PluginManifest` + `Plugin` juntos — manifesto válido/inválido, registro duplicado rejeitado, transição de estado inválida rejeitada, um `PluginSource` fake com candidatos válidos e inválidos carregando só o válido, e `subscribe()` observando os eventos — antes de apagar o script.

Para o sistema de dispositivos (sem runtime para testar, já que é só tipos): um script descartável equivalente montou implementações fake de `DeviceProvider` e `DeviceRegistry` e um objeto de cada variante de `DeviceEvent`, só para confirmar que as interfaces realmente compõem sem `as any` em nenhum lugar — também apagado depois.

Para o Dashboard: `next build` (Turbopack) chegou a compilar toda a página, os componentes novos e o `recharts` sem nenhum erro — parou só na etapa de otimização das fontes `Geist`/`Geist Mono` via `next/font/google`, que exige buscar `fonts.googleapis.com` em build time (indisponível neste ambiente de desenvolvimento; funciona normalmente com acesso à internet).

## Próximos passos (não feitos agora, de propósito)

- Implementação concreta de `DeviceRegistry` (provavelmente em `@nexus/infrastructure`, já que agregar múltiplos providers é decisão de infraestrutura).
- Primeiro `DeviceProvider` real (ex.: Home Assistant) — ainda sem Windows/Tuya/Docker, que seguem fora de escopo.
- Entidade Espaço/Ambiente em `@nexus/domain` (hoje `Device.spaceId` é só `string`, e o Dashboard usa um lookup mockado em paralelo).
- Primeiro caso de uso real em `@nexus/application` (ex.: `ExecuteDeviceAction`, orquestrando `DeviceRegistry` + `DeviceProvider`).
- Ligar o Dashboard a dados reais (trocar `apps/web/lib/mocks/*` por chamadas à camada de aplicação) — explicitamente fora de escopo por enquanto.
- `apps/plugin-host` implementando um `PluginSource` real (descoberta em `packages/plugins/*`) e usando `PluginRegistry`/`PluginLoader`.
- Primeiro plugin real em `packages/plugins/`.
- Páginas reais em `apps/web` além do Dashboard.
