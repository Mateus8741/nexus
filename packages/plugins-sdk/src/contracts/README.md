# contracts

Contratos que todo plugin implementa:

- `manifest.ts` — `PluginManifest` (id, versão, capacidades declaradas, faixa de compatibilidade) + `isPluginManifest`/`assertPluginManifest` para validar em runtime.
- `plugin.ts` — a interface `Plugin` (`manifest`, `onStart`, `onStop`, `onInstall?`, `onUninstall?`) + `isPlugin`.
- `context.ts` — `PluginContext`, a única superfície que o host injeta nos hooks de um plugin (logger + config), deliberadamente mínima.
