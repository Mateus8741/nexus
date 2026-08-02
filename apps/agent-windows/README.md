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

O id do dispositivo (`agentId`) é gerado uma vez e persistido em `~/.nexus/agent-id` (no Windows, `%USERPROFILE%\.nexus\agent-id`) — reinícios do processo continuam sendo reconhecidos como o mesmo dispositivo pelo Core.

Ações reais (`shutdown`/`restart`/`lock`/comando arbitrário) só executam quando `process.platform === "win32"`. Rodando em qualquer outro SO (dev/teste, incluindo o ambiente onde isto foi construído), as ações são simuladas — ver `src/system-actions.ts`.

## Distribuindo para uma máquina Windows real

Não é preciso instalar Bun/Node nem copiar o monorepo inteiro na máquina Windows monitorada. `bun build --compile` empacota o Agent, o runtime do Bun e todas as dependências num único executável nativo (`.exe`), gerado por cross-compilation a partir de qualquer SO (Linux, macOS, Windows):

```
bun run --filter @nexus/agent-windows package:windows
```

Isso gera `apps/agent-windows/dist/nexus-agent-windows.exe` (~95 MB, porque embute o runtime inteiro — normal para este tipo de binário). Copie só esse arquivo para a máquina Windows e rode:

```cmd
set NEXUS_CORE_URL=ws://<ip-do-core>:4600
set NEXUS_DEVICE_NAME=PC-da-Sala
nexus-agent-windows.exe
```

(ou, no PowerShell: `$env:NEXUS_CORE_URL="ws://<ip-do-core>:4600"; .\nexus-agent-windows.exe`)

`dist/` é ignorado pelo `.gitignore` e pelo Biome — o executável é sempre gerado sob demanda a partir do código-fonte, nunca é a fonte da verdade. Rode o `package:windows` de novo sempre que `src/` ou `@nexus/agent-protocol` mudarem.

Sem instalador/serviço Windows nesta etapa — é só um `.exe` que roda em primeiro plano (uma janela de terminal fica aberta). Rodar como serviço do Windows (iniciar sozinho no boot, sem janela) é um passo futuro.
