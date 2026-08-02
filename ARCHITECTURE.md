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

## 11. Primeiro provider real: Windows (`@nexus/plugin-windows` + `apps/agent-windows`)

Objetivo explícito: não implementar todas as funcionalidades do Windows, e sim validar a arquitetura que qualquer plugin futuro (Docker, Home Assistant, Tuya, Linux, macOS) vai reaproveitar. Por isso a peça mais importante desta etapa não é o Windows em si — é a cadeia de abstrações em volta dele.

**Cadeia de dependência** (setas = "conhece"):

```
apps/plugin-host (composition root)
   → @nexus/plugins-sdk    (PluginRegistry, PluginLoader, AgentGateway — abstrações)
   → @nexus/application    (AttachDeviceProviderUseCase — orquestra Provider ↔ Registry)
   → @nexus/domain         (Device, DeviceProvider, DeviceRegistry, DeviceEvent — abstrações)
   → @nexus/infrastructure (InMemoryDeviceRegistry, WebSocketAgentGateway — implementações concretas)
   → @nexus/plugin-windows (implementa Plugin + DeviceProvider — só aqui existe "Windows")
                                    ↕ WebSocket (@nexus/agent-protocol)
                              apps/agent-windows (processo separado, roda na máquina Windows)
```

`apps/plugin-host` é o único arquivo do monorepo autorizado a conhecer, ao mesmo tempo, uma abstração e a implementação concreta dela — e o único que importa `@nexus/plugin-windows` diretamente. Nenhuma outra peça do sistema sabe que existe Windows.

- **`@nexus/agent-protocol`** (pacote novo, zero deps): o "idioma" comum entre o Core e um Agent remoto — união discriminada `AgentMessage` (`register`, `heartbeat`, `metrics`, `action-result`) e `CoreMessage` (`action-command`), com type guards (`isAgentMessage`/`isCoreMessage`), no mesmo estilo do `isPluginManifest` que já existia. É o único pacote que `apps/agent-windows` importa do monorepo Nexus — o resto (o formato exato das mensagens) é o suficiente para, no futuro, reescrever um agent em outra linguagem sem tocar em mais nada.
- **`AgentGateway`/`AgentConnection`** (novo em `@nexus/plugins-sdk/contracts`): porta agnóstica de transporte — "aceitar conexões de agents remotos" sem dizer que é WebSocket. `WebSocketAgentGateway` (em `@nexus/infrastructure`, usando a lib `ws`) é a única implementação concreta; o host injeta essa instância no plugin, o plugin nunca cria a sua própria.
- **`InMemoryDeviceRegistry`** (novo em `@nexus/infrastructure`): primeira implementação concreta de `DeviceRegistry` (até aqui só a interface existia). A interface ganhou um método novo, `notify(event)`, para completar o par com `subscribe()` — `register`/`unregister`/`updateState` só mutam estado; `notify` é quem publica um evento para os assinantes, chamado por quem estiver sincronizando o registry com um provider (nunca internamente), preservando a fidelidade do evento original.
- **`AttachDeviceProviderUseCase`** (novo em `@nexus/application`, primeiro caso de uso real do pacote): conecta **qualquer** `DeviceProvider` a um `DeviceRegistry` — registra o que o provider já conhece e mantém sincronizado com os eventos dele depois. Não sabe nada sobre Windows; processa os eventos em fila (um de cada vez) para garantir que `notify()` publique na mesma ordem em que o provider emitiu, mesmo quando um evento exige uma chamada assíncrona (`device.connected`) e o seguinte não (`device.state-changed`) — um bug real que o smoke test pegou antes da correção.
- **`WindowsDeviceProvider`** (novo em `packages/plugins/windows`, implementa `DeviceProvider`): recebe um `AgentGateway` e nunca fala com Windows diretamente — só interpreta mensagens de `@nexus/agent-protocol`. `register` cria o `Device` (usa o `agentId`, persistido pelo Agent, como `Device.id` — é o que faz reconexões serem reconhecidas como o mesmo dispositivo); `heartbeat`/`metrics` resetam um timer de 30s (se ele estourar, ou se o socket fechar, o dispositivo vira `offline` — nunca é removido do registry); `executeAction` valida o tipo da ação contra as 4 suportadas, gera um `requestId`, e correlaciona a resposta assíncrona (`action-result`) com timeout de 15s.
- **`apps/agent-windows`** (app novo): processo standalone, separado do Core de propósito. Só depende de `@nexus/agent-protocol` e `ws`. Persiste um `agentId` (UUID) em `~/.nexus/agent-id` para sobreviver a reinícios. Métricas (CPU/RAM/disco/uptime) via `node:os`/`node:fs`, com CPU estimada por amostragem (duas leituras de `os.cpus()`). As 4 ações (`shutdown`/`restart`/`lock`/`executeCommand`) passam por uma interface `SystemActions` injetável — a implementação real (`WindowsSystemActions`) só roda quando `process.platform === "win32"`; em qualquer outro SO (incluindo este ambiente de desenvolvimento) usa `SimulatedSystemActions`, que nunca executa nada de verdade. Isso permitiu validar o fluxo inteiro (registro → heartbeat → métricas → ação → desconexão) neste sandbox Linux sem risco de desligar a máquina onde o Agent roda.

**Ajuste ao workspace**: `packages/plugins/*` foi adicionado ao `workspaces` do `package.json` raiz — o glob `packages/*` não alcançava um pacote dois níveis abaixo (`packages/plugins/windows`).

**Pendência de segurança, deliberada e registrada aqui**: o WebSocket do `WebSocketAgentGateway` não tem nenhuma autenticação nesta etapa — qualquer processo que conseguir abrir a conexão é tratado como um Agent válido. Isso combina com o escopo pedido ("validar a arquitetura"), mas não deve ser exposto fora de `localhost`/rede confiável antes de um mecanismo de autenticação ser implementado.

**Reaproveitamento por plugins futuros**: Docker, Home Assistant e Tuya reaproveitam a cadeia `DeviceProvider` → `AttachDeviceProviderUseCase` → `DeviceRegistry` sem alteração nenhuma — mas, como eles falam direto com uma API/daemon já existente, provavelmente não precisam de `AgentGateway`/`@nexus/agent-protocol` (isso é específico do "padrão Agent"). Linux e macOS, por outro lado, reaproveitam a arquitetura inteira, incluindo o Agent — um `apps/agent-linux`/`apps/agent-macos` seria só uma nova implementação de `SystemActions`/coleta de métricas falando o mesmo `@nexus/agent-protocol`.

## 12. O que foi validado

Rodado neste ambiente antes de cada entrega: `bun install`, `bun run typecheck` (tsc --noEmit em todos os pacotes), `bun run lint` (ESLint em `apps/web`) e `bun run check` (Biome) — todos passando sem erro.

Para o sistema de plugins: um script descartável (não commitado) exercitou `PluginRegistry` + `PluginLoader` + `PluginManifest` + `Plugin` juntos — manifesto válido/inválido, registro duplicado rejeitado, transição de estado inválida rejeitada, um `PluginSource` fake com candidatos válidos e inválidos carregando só o válido, e `subscribe()` observando os eventos — antes de apagar o script.

Para o sistema de dispositivos (sem runtime para testar, já que é só tipos): um script descartável equivalente montou implementações fake de `DeviceProvider` e `DeviceRegistry` e um objeto de cada variante de `DeviceEvent`, só para confirmar que as interfaces realmente compõem sem `as any` em nenhum lugar — também apagado depois.

Para o Dashboard: `next build` (Turbopack) chegou a compilar toda a página, os componentes novos e o `recharts` sem nenhum erro — parou só na etapa de otimização das fontes `Geist`/`Geist Mono` via `next/font/google`, que exige buscar `fonts.googleapis.com` em build time (indisponível neste ambiente de desenvolvimento; funciona normalmente com acesso à internet).

Para o provider Windows: um script descartável subiu, num único processo, `WebSocketAgentGateway` + `WindowsDeviceProvider` + `AttachDeviceProviderUseCase` + `InMemoryDeviceRegistry` (lado Core) conversando via WebSocket real com um `WindowsAgent` de verdade (lado Agent, com `SimulatedSystemActions`, já que este ambiente não é Windows). Validou, na ordem: registro automático criando o `Device` no registry como `online`; a primeira leitura de métricas populando `state.attributes`; `executeAction("executeCommand")` correlacionando a resposta pelo `requestId` e retornando sucesso; uma ação não suportada (`"screenshot"`) sendo rejeitada sem nunca chegar a ser enviada ao Agent; e, ao parar o Agent, o dispositivo virando `offline` no registry (nunca removido). Foi este script que expôs o bug de ordenação de eventos corrigido em `AttachDeviceProviderUseCase` (ver seção 11). Também confirmado via `bun run --filter @nexus/plugin-host dev` + `bun run --filter @nexus/agent-windows dev` como dois processos de verdade, não só em memória — script apagado depois.

## 13. Dashboard com dados reais (`apps/plugin-host` API HTTP + `apps/web`)

Objetivo: o Dashboard parar de ser 100% mockado, sem inventar sistemas que não existem (Ambiente/Espaço continua sem entidade própria — ver seção 9).

**Por que HTTP e não import direto**: `apps/plugin-host` e `apps/web` são processos Node separados (o próprio `apps/plugin-host` já existe assim de propósito, por precisar manter conexões vivas — ver seção 3/`apps/plugin-host/README.md`). O Dashboard não pode importar `InMemoryDeviceRegistry`/`PluginRegistry` diretamente; ele busca os dados via `fetch` de dentro de um Server Component, Node→Node, sem passar pelo browser — por isso a API não tem (nem precisa de) CORS.

- **DTOs compartilhados** (`@nexus/application/src/dto/*`, novo): `DeviceDto`/`DeviceEventDto`/`DeviceStateDto` são as versões JSON-safe de `Device`/`DeviceEvent`/`DeviceState` (`Date` vira `string` ISO — `previousState` ausente vira `null`, não `undefined`, porque `JSON.stringify` descarta chaves `undefined`). Cada um tem `to*Dto`/`from*Dto`: `apps/plugin-host` serializa com `to*Dto`, `apps/web` desserializa com `from*Dto` de volta para os MESMOS tipos de `@nexus/domain` que os componentes do Dashboard já esperavam — nenhum componente precisou mudar sua assinatura de props por causa disso.
- **API HTTP do Core** (`apps/plugin-host/src/http/`, novo): servidor `node:http` puro (sem Express, mesma filosofia hand-rolled do `WebSocketAgentGateway`), porta via `NEXUS_HTTP_PORT` (padrão `4700`, ao lado do `NEXUS_AGENT_GATEWAY_PORT` do WebSocket). Rotas: `GET /devices`, `GET /events?limit=N`, `GET /plugins`, `GET /providers`, `GET /health`. `EventLog` (novo, também em `apps/plugin-host/src/http/`) é um buffer circular em memória (200 eventos) assinado no `deviceRegistry.subscribe()` — existe porque o `DeviceRegistry` só guarda o snapshot vivo de cada `Device`, não histórico; sem isso não haveria "atividade recente" real para mostrar.
- **Cliente no Dashboard** (`apps/web/lib/nexus-client.ts`, novo): `fetchDevices`/`fetchEvents`/`fetchPlugins`/`fetchProviders`, todas com `cache: "no-store"` (dado operacional, sempre fresco) e todas **tolerantes a falha** — se `apps/plugin-host` não estiver rodando, cada uma faz `console.warn` e devolve `[]`, nunca derruba a página. `app/page.tsx` virou um Server Component assíncrono buscando as quatro fontes em paralelo.
- **"Ambientes" virou "Integrações"**: como `@nexus/domain` ainda não tem entidade Espaço/Ambiente, o agrupamento por ambiente (que era só mock) foi substituído por um agrupamento real por `DeviceProvider` (`provider-overview.tsx`, renomeado de `environment-overview.tsx`) — hoje só mostra "Windows", mas cresce automaticamente quando houver mais providers, sem mudar o componente.
- **Honestidade mantida e atualizada**: "Dispositivos online" e "Integrações" agora mostram dados reais; "Plugins instalados" também virou real (`1`, porque `@nexus/plugin-windows` roda de verdade) — só "Automações ativas" continua `"0"`, porque esse sistema genuinely não existe ainda. O gráfico de atividade (24h) continua mockado, deliberadamente — construir agregação histórica de métricas é um passo à parte, não incluído aqui — e o texto ao lado do gráfico deixa isso explícito agora que o resto da página é real.
- **Empty state**: com zero dispositivos conectados (Core fora do ar, ou nenhum Agent conectado ainda), a tabela e o feed mostram uma mensagem mínima em vez de uma área em branco confusa.

**Validado end-to-end neste ambiente**: subi `apps/plugin-host`, `apps/agent-windows` (simulado) e `apps/web` juntos (três processos reais, portas de teste dedicadas) — confirmei via `curl` que `/devices`, `/providers`, `/plugins` e `/events` respondem com o dispositivo simulado real, e então confirmei que o HTML retornado por `apps/web` contém o nome real do dispositivo (`"PC-Teste"`), o status `online` vindo da API, e a contagem real de plugins — não os dados mockados antigos.

**Consequência prática ao rodar `bun run dev` na raiz**: como `apps/agent-windows` já tem um script `dev` (necessário para o desenvolvimento normal dele), o `turbo run dev` da raiz sobe `apps/web` + `apps/plugin-host` + `apps/agent-windows` juntos por padrão. Isso é intencional nesta fase: rodar `bun run dev` já deixa o Dashboard com pelo menos um dispositivo real (simulado, já que este ambiente não é Windows) para mostrar, sem passos manuais extras.

## 14. Empacotamento do `apps/agent-windows` (executável standalone)

Objetivo: alguém com um Windows real não deveria precisar instalar Bun/Node nem clonar o monorepo inteiro só para rodar o Agent.

`bun build --compile` resolve isso: empacota o Agent + o runtime do Bun + todas as dependências (`@nexus/agent-protocol`, `ws`) num único executável nativo, via cross-compilation a partir de qualquer SO — usado aqui a partir deste ambiente Linux para gerar um `.exe` de Windows de verdade (confirmado via `file`: `PE32+ executable (console) x86-64, for MS Windows`).

- Script: `bun run --filter @nexus/agent-windows package:windows` → gera `apps/agent-windows/dist/nexus-agent-windows.exe` (~95 MB — o tamanho vem de embutir o runtime inteiro, é esperado para esse tipo de binário).
- `dist/` já estava no `.gitignore` e excluído do Biome desde o início do projeto (seção 1) — o executável nunca é a fonte da verdade, é sempre gerado sob demanda a partir de `src/`.
- Configuração continua via variáveis de ambiente (`NEXUS_CORE_URL`, `NEXUS_DEVICE_NAME`), agora setadas no `cmd`/PowerShell do Windows em vez de num shell Unix — documentado em `apps/agent-windows/README.md`.
- As flags `--windows-title`/`--windows-description`/etc. do `bun build --compile` (metadados do executável, ícone) só funcionam compilando a partir de um Windows de verdade — não deu para usar aqui; o `.exe` gerado funciona normalmente, só aparece com metadados genéricos no Explorer.
- Fora de escopo aqui: um instalador, rodar como serviço do Windows (start automático no boot, sem janela de terminal visível) — hoje é só um executável em primeiro plano.

Isso resolve, para `apps/agent-windows` especificamente, a pendência que estava registrada em "Próximos passos" sobre precisar de um bundler — `apps/plugin-host` continua rodando via `bun run dev`/`tsx` no servidor (nunca é distribuído como executável, então não tem a mesma urgência).

## 15. Descoberta automática do Core na rede local (UDP broadcast)

Objetivo: ninguém deveria precisar descobrir manualmente o IP da máquina que roda o Core para configurar o `.exe` numa máquina Windows nova — isso era a única fricção restante no fluxo de distribuição da seção 14.

Novo protocolo de descoberta em `@nexus/agent-protocol/discovery.ts` (zero deps, igual ao resto do pacote): `DiscoveryRequestMessage`/`DiscoveryResponseMessage`, porta UDP fixa `DISCOVERY_DEFAULT_PORT = 41234` (separada da porta HTTP/WebSocket do Core — ver seção 16, que unificou HTTP e WebSocket numa porta só).

- `apps/plugin-host/src/discovery/discovery-responder.ts` — `DiscoveryResponder`, novo componente do bootstrap: escuta UDP na porta 41234 em todas as interfaces (`0.0.0.0`), e para todo pacote `nexus-discover` válido responde (unicast, de volta para quem perguntou) com hostname + a porta única do Core. Não conhece nada sobre Windows/plugins — só "estou aqui, minha porta é X". Fechado no `shutdown()` junto com o resto.
- `apps/agent-windows/src/discovery.ts` — `discoverCore()`: se `NEXUS_CORE_URL` não estiver definida, o Agent manda um `nexus-discover` em broadcast (`255.255.255.255:41234`) e resolve com o primeiro `nexus-here` que receber, usando o **IP de origem do pacote UDP de resposta** (garantido pelo próprio kernel/SO, nunca um valor dentro do payload) para montar `ws://<ip>:<port>`. Isso é o que resolve corretamente o caso de o Core ter múltiplas interfaces de rede (Wi-Fi + Ethernet, por exemplo): o Agent automaticamente usa a interface por onde a resposta realmente chegou.
- Timeout de 3s; se ninguém responder (Core desligado, firewall bloqueando UDP broadcast, ou sub-redes diferentes que o roteador não repassa broadcast entre si), o Agent imprime instruções para definir `NEXUS_CORE_URL` manualmente e encerra — a configuração manual sempre continua funcionando como fallback.
- Sem autenticação nesta etapa, mesma postura do resto do protocolo — qualquer processo na rede local pode perguntar "onde está o Core?" e receber a resposta. Ver seção "Próximos passos".
- Validado via smoke test isolado (responder + `discoverCore()` no mesmo processo, unicast direto porta-a-porta) confirmando o formato de mensagens e o fluxo de request/response; broadcast de verdade (`255.255.255.255`) não foi testável dentro do sandbox de desenvolvimento (redes de container tipicamente bloqueiam broadcast), mas o mecanismo é padrão de rede local (mesmo usado por SSDP/mDNS) e funciona em LANs domésticas/de escritório reais.
- **Importante**: broadcast UDP não atravessa a internet — funciona só quando Agent e Core estão na mesma rede local. Quando o Core roda na nuvem (seção 16), a descoberta automática sempre vai falhar (timeout de 3s) por design, e o `NEXUS_CORE_URL` manual (`wss://...`) é sempre obrigatório nesse cenário.

## 16. Deploy do Core e do Dashboard na nuvem (Coolify)

Objetivo: hospedar `apps/web` (Dashboard) e `apps/plugin-host` (Core) num servidor na nuvem via Coolify, em vez de rodar localmente no computador de quem administra o Nexus — os Agents (`apps/agent-windows`, e futuramente Linux/macOS) continuam rodando nas máquinas monitoradas, mas agora se conectam por um domínio público em vez de um IP de rede local.

Mudanças de arquitetura exigidas por isso (nenhuma delas específica de Coolify — servem para qualquer PaaS baseado em reverse proxy por domínio/porta única, ex.: Railway, Render, um VPS com Traefik/Caddy):

- **HTTP e WebSocket na mesma porta**: um reverse proxy típico (Traefik, usado pelo Coolify) mapeia um domínio para UMA porta do container. `WebSocketAgentGateway` (`@nexus/infrastructure`) agora aceita `{ server: http.Server }` além de `{ port }` — o upgrade HTTP→WebSocket é anexado ao MESMO `http.Server` que serve a API REST (`ws` package suporta isso nativamente via `new WebSocketServer({ server })`). `apps/plugin-host` usa essa forma; a variável `NEXUS_AGENT_GATEWAY_PORT` deixou de existir — só `PORT` (convenção comum de PaaS) ou `NEXUS_HTTP_PORT`, com um valor único servindo os dois protocolos. O protocolo de descoberta (seção 15) também foi simplificado para reportar uma porta só (`port`, não mais `wsPort`/`httpPort`).
- **`apps/web` com `output: "standalone"`** (`next.config.ts`) — gera um `server.js` autocontido com só os arquivos/`node_modules` realmente usados, em vez de exigir o monorepo inteiro na imagem final.
- **Dockerfiles multi-stage** para os dois apps (`apps/web/Dockerfile`, `apps/plugin-host/Dockerfile`), usando o padrão oficial de Docker para monorepos Turborepo: `turbo prune <app> --docker` gera `out/json` (só os `package.json`/lockfile das dependências necessárias — camada cacheável) e `out/full` (código-fonte já podado); a imagem final não carrega o monorepo inteiro, só o que cada app usa. `apps/plugin-host` não precisa de etapa de build — Bun executa TypeScript direto, mesmo princípio de `apps/agent-windows`. `.dockerignore` na raiz evita copiar `node_modules`/`.git`/`.next` para o contexto de build.
- Validado sem Docker instalado no ambiente de desenvolvimento: reproduzi manualmente os passos de cada estágio (`turbo prune --docker`, `bun install --frozen-lockfile` sobre o esqueleto `out/json`, depois sobrepor `out/full`) e confirmei que `apps/plugin-host` sobe e responde em `/health`/`/devices`/`/providers` a partir da árvore podada; o build completo de `apps/web` não pôde ser validado neste ambiente porque `next/font/google` precisa baixar as fontes do Google no momento do build e este sandbox bloqueia esse domínio (mesma limitação já documentada nas seções anteriores) — isso não afeta o Coolify, cujo ambiente de build tem acesso normal à internet.

Configuração no Coolify (dois "apps" separados, mesmo repositório Git):

| | `apps/web` | `apps/plugin-host` |
|---|---|---|
| Build pack | Dockerfile | Dockerfile |
| Base Directory (contexto) | raiz do repo | raiz do repo |
| Dockerfile Location | `apps/web/Dockerfile` | `apps/plugin-host/Dockerfile` |
| Porta exposta | 3000 | 4700 (configurável via `PORT`) |
| Variáveis de ambiente | `NEXUS_PLUGIN_HOST_URL=https://<domínio-do-plugin-host>` | nenhuma obrigatória (autenticação ainda não existe — ver "Próximos passos") |
| Domínio | ex.: `app.seudominio.com` | ex.: `core.seudominio.com` |

Nos Agents (`apps/agent-windows`), `NEXUS_CORE_URL` deve apontar para `wss://core.seudominio.com` (o `wss://` — não `ws://` — porque o Traefik termina TLS; a lib `ws` já suporta o esquema `wss://` sem mudança de código). A descoberta automática (seção 15) nunca vai funcionar nesse cenário (broadcast não atravessa a internet) — configurar manualmente é sempre necessário aqui.

## Próximos passos (não feitos agora, de propósito)

- **Autenticação no `AgentGateway`**: hoje qualquer processo que abrir o WebSocket é tratado como Agent válido — pendência de segurança registrada na seção 11, antes de qualquer exposição fora de `localhost`. A API HTTP da seção 13 também não tem autenticação (mesma lógica: só pensada para uso local/interno por enquanto). O protocolo de descoberta da seção 15 tem a mesma postura: qualquer um na rede local pode perguntar "onde está o Core?" e obter resposta. **Isso fica mais urgente com o deploy na nuvem (seção 16)**: hoje, qualquer pessoa que descobrir o domínio `wss://core.seudominio.com` pode se conectar como se fosse um Agent válido e registrar dispositivos falsos, e qualquer um pode ler `https://core.seudominio.com/devices` — não expor esse domínio antes de existir autenticação (token/API key no mínimo) é uma recomendação forte, não só uma nota de rodapé.
- Instalador/serviço Windows para `apps/agent-windows` que também empacote a descoberta automática num fluxo "baixou, rodou, funcionou" sem qualquer variável de ambiente — a descoberta em si (seção 15) já elimina a necessidade de digitar o IP manualmente, mas ainda falta o passo de rodar como serviço no boot (ver item já existente logo abaixo).
- Funcionalidades do Windows explicitamente adiadas: screenshot, explorer, terminal remoto, transferência de arquivos, clipboard, processos, serviços, Wake On LAN, Remote Desktop, instalação de softwares.
- Métricas mais detalhadas: disco por drive (`C:\`, `D:\`, ...) em vez de um único percentual agregado; CPU por núcleo.
- Persistência real do `DeviceRegistry` (hoje `InMemoryDeviceRegistry` esquece tudo ao reiniciar `apps/plugin-host`, e o `EventLog` da seção 13 também é só em memória).
- `apps/plugin-host` implementando um `PluginSource` real (descoberta em disco de `packages/plugins/*`) em vez do array embutido usado nesta etapa.
- Próximo `DeviceProvider` (Docker, Home Assistant, Tuya, Linux ou macOS) reaproveitando `AttachDeviceProviderUseCase` sem alteração — Linux/macOS reaproveitam também `@nexus/agent-protocol`/`AgentGateway`.
- Entidade Espaço/Ambiente em `@nexus/domain` — quando existir, "Integrações" (seção 13) e um futuro agrupamento por Ambiente podem conviver, cada um mostrando uma dimensão diferente dos mesmos dispositivos.
- UI para disparar ações (`shutdown`/`restart`/`lock`/`executeCommand`) a partir do Dashboard — a API HTTP desta etapa só tem rotas de leitura (`GET`), de propósito, para manter o escopo focado em "mostrar dados reais" antes de "controlar dispositivos pela UI".
- Atualização ao vivo do Dashboard (WebSocket/SSE do browser para o Core) — hoje os dados só atualizam quando a página é recarregada, já que o fetch usa `cache: "no-store"` mas é feito uma vez por request do servidor.
- Agregação histórica real para o gráfico de atividade (24h) — hoje continua mockado, mesmo com o resto do Dashboard já real.
- Instalador/serviço Windows para `apps/agent-windows` (start automático no boot, sem janela de terminal visível) — hoje é só o `.exe` gerado na seção 14, rodando em primeiro plano.
- Um bundler (ex.: `tsup`/`esbuild`) especificamente para `apps/plugin-host`, caso um dia ele precise ser distribuído como executável fora do servidor onde já roda via `bun run dev`/`start` — `apps/agent-windows` já resolveu isso via `bun build --compile` (seção 14).
- Páginas reais em `apps/web` além do Dashboard.
