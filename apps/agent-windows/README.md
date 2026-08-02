# @nexus/agent-windows

Processo Node.js standalone, separado do Core (`apps/plugin-host`), que roda NA máquina Windows monitorada. Coleta métricas (CPU/RAM/disco/uptime), se registra automaticamente junto ao `@nexus/plugin-windows` via WebSocket, manda heartbeat e executa ações (`shutdown`/`restart`/`lock`/`executeCommand`) recebidas do Core.

Depende só de `@nexus/agent-protocol` (o formato das mensagens) e da lib `ws` — nada do resto do monorepo Nexus. Isso é proposital: no futuro este processo pode ser reescrito em outra linguagem (Go, Rust, C#) como um serviço Windows de verdade, sem que nada em `@nexus/agent-protocol` precise mudar.

## Rodando

```
bun run --filter @nexus/agent-windows dev
```

Variáveis de ambiente:

- `NEXUS_CORE_URL` — endereço do WebSocket do Core (padrão `ws://localhost:4600`).
- `NEXUS_DEVICE_NAME` — nome de exibição do dispositivo (padrão: hostname da máquina).

O id do dispositivo (`agentId`) é gerado uma vez e persistido em `~/.nexus/agent-id` — reinícios do processo continuam sendo reconhecidos como o mesmo dispositivo pelo Core.

Ações reais (`shutdown`/`restart`/`lock`/comando arbitrário) só executam quando `process.platform === "win32"`. Rodando em qualquer outro SO (dev/teste, incluindo o ambiente onde isto foi construído), as ações são simuladas — ver `src/system-actions.ts`.
