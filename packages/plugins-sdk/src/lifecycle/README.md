# lifecycle

`state.ts` define `PluginState` (`registered | starting | started | stopping | stopped | error`) e `PLUGIN_STATE_TRANSITIONS`, a tabela de transições válidas. Puramente declarativo — não executa nada; é o `PluginRegistry` (em `src/registry.ts`) que consulta isso para validar `setState()`.
