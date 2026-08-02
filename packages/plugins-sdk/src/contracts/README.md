# contracts

Contratos que todo plugin implementa:

- `manifest.ts` — `PluginManifest` (id, versão, capacidades declaradas, faixa de compatibilidade) + `isPluginManifest`/`assertPluginManifest` para validar em runtime.
- `plugin.ts` — a interface `Plugin` (`manifest`, `onStart`, `onStop`, `onInstall?`, `onUninstall?`) + `isPlugin`.
- `context.ts` — `PluginContext`, a única superfície que o host injeta nos hooks de um plugin (logger + config), deliberadamente mínima.
- `agent-gateway.ts` — `AgentGateway`/`AgentConnection`, porta agnóstica de transporte usada por plugins no "padrão Agent" (ex.: `@nexus/plugin-windows`) para aceitar conexões de agents remotos. O host injeta uma implementação concreta (ex.: `WebSocketAgentGateway`, em `@nexus/infrastructure`); o plugin nunca cria a sua própria. Plugins que não usam esse padrão (ex.: um futuro provider de Home Assistant, que fala direto com a API da HA) simplesmente não a usam.
