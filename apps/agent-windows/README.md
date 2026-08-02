# @nexus/agent-windows

Processo Node.js standalone, separado do Core (`apps/plugin-host`), que roda NA máquina Windows monitorada. Coleta métricas (CPU/RAM/disco/uptime), se registra automaticamente junto ao `@nexus/plugin-windows` via WebSocket, manda heartbeat e executa ações (`shutdown`/`restart`/`lock`/`executeCommand`) recebidas do Core.

Depende só de `@nexus/agent-protocol` (o formato das mensagens) e da lib `ws` — nada do resto do monorepo Nexus. Isso é proposital: no futuro este processo pode ser reescrito em outra linguagem (Go, Rust, C#) como um serviço Windows de verdade, sem que nada em `@nexus/agent-protocol` precise mudar.

## Rodando

```
bun run --filter @nexus/agent-windows dev
```

Variáveis de ambiente:

- `NEXUS_CORE_URL` — endereço do WebSocket do Core (opcional — ver "Descoberta automática do Core" abaixo).
- `NEXUS_DEVICE_NAME` — nome de exibição do dispositivo (padrão: hostname da máquina).

## Descoberta automática do Core

Se `NEXUS_CORE_URL` não for definido, o Agent pergunta sozinho "onde está o Core?" via broadcast UDP na rede local (porta 41234) e usa o primeiro que responder — não é preciso descobrir/digitar o IP manualmente. Isso funciona quando Core e Agent estão na mesma rede local (mesmo Wi-Fi/switch), o que é o caso típico.

Se ninguém responder em 3 segundos (Core desligado, firewall bloqueando UDP broadcast, ou máquinas em sub-redes diferentes que o roteador não repassa broadcast entre si), o Agent desiste e imprime instruções para definir `NEXUS_CORE_URL` manualmente:

```cmd
set NEXUS_CORE_URL=ws://192.168.1.10:4700
```

A descoberta automática é sempre tentada primeiro; `NEXUS_CORE_URL` manual sempre tem prioridade quando definida (útil se broadcast estiver bloqueado ou Core/Agent estiverem em redes diferentes via VPN, por exemplo).

**Se o Core estiver hospedado na nuvem** (ex.: Coolify — ver ARCHITECTURE.md seção 16) em vez de rodar na sua rede local, a descoberta automática NUNCA vai encontrar nada (broadcast UDP não atravessa a internet) — isso é esperado, não um bug. Configure sempre manualmente, usando `wss://` (WebSocket com TLS) em vez de `ws://`:

```cmd
set NEXUS_CORE_URL=wss://core.seudominio.com
```

O id do dispositivo (`agentId`) é gerado uma vez e persistido em `~/.nexus/agent-id` (no Windows, `%USERPROFILE%\.nexus\agent-id`) — reinícios do processo continuam sendo reconhecidos como o mesmo dispositivo pelo Core.

Ações reais (`shutdown`/`restart`/`lock`/comando arbitrário) só executam quando `process.platform === "win32"`. Rodando em qualquer outro SO (dev/teste, incluindo o ambiente onde isto foi construído), as ações são simuladas — ver `src/system-actions.ts`.

## Distribuindo para uma máquina Windows real

Não é preciso instalar Bun/Node nem copiar o monorepo inteiro na máquina Windows monitorada. `bun build --compile` empacota o Agent, o runtime do Bun e todas as dependências num único executável nativo (`.exe`), gerado por cross-compilation a partir de qualquer SO (Linux, macOS, Windows):

```
bun run --filter @nexus/agent-windows package:windows
```

Isso gera `apps/agent-windows/dist/nexus-agent-windows.exe` (~95 MB, porque embute o runtime inteiro — normal para este tipo de binário). Copie só esse arquivo para a máquina Windows e rode:

```cmd
set NEXUS_DEVICE_NAME=PC-da-Sala
nexus-agent-windows.exe
```

Sem precisar definir `NEXUS_CORE_URL` — o Agent encontra o Core sozinho na rede local (ver "Descoberta automática do Core" acima). Só defina `NEXUS_CORE_URL` manualmente se a descoberta automática falhar:

```cmd
set NEXUS_CORE_URL=ws://<ip-do-core>:4700
set NEXUS_DEVICE_NAME=PC-da-Sala
nexus-agent-windows.exe
```

(ou, no PowerShell: `$env:NEXUS_CORE_URL="ws://<ip-do-core>:4700"; .\nexus-agent-windows.exe`)

Se o Core estiver na nuvem (Coolify), use `wss://` + o domínio, em vez de `ws://` + IP:

```
$env:NEXUS_CORE_URL="wss://core.seudominio.com"; .\nexus-agent-windows.exe
```

`dist/` é ignorado pelo `.gitignore` e pelo Biome — o executável é sempre gerado sob demanda a partir do código-fonte, nunca é a fonte da verdade. Rode o `package:windows` de novo sempre que `src/` ou `@nexus/agent-protocol` mudarem.

## Instalação permanente (roda sozinho, em segundo plano)

Pra não precisar abrir terminal e digitar comando toda vez que for colocar o Agent numa máquina nova, use `scripts/install.ps1`: ele copia o `.exe`, salva a configuração (`NEXUS_CORE_URL`/`NEXUS_DEVICE_NAME`) e cria um atalho na pasta "Inicializar" do usuário apontando pro PowerShell rodando o Agent escondido (sem janela) — o Windows executa isso automaticamente sempre que ele fizer login — e já inicia na hora, sem esperar o próximo login. Não depende do Task Scheduler nem do Windows Script Host (wscript.exe/cscript.exe), então funciona mesmo em PCs corporativos com política de grupo restritiva (esse foi, na prática, o motivo de duas versões anteriores deste instalador não funcionarem — ver ARCHITECTURE.md seção 17).

Copie `nexus-agent-windows.exe`, `scripts/install.ps1` e `scripts/uninstall.ps1` para a mesma pasta na máquina Windows e, no PowerShell:

```powershell
.\install.ps1 -CoreUrl "wss://core.seudominio.com" -DeviceName "PC-da-Sala"
```

(ou `-CoreUrl "ws://192.168.0.8:4700"` se o Core estiver na rede local). Não precisa rodar como Administrador. Depois disso, nunca mais é preciso setar `NEXUS_CORE_URL`/`NEXUS_DEVICE_NAME` manualmente nessa máquina — ficam persistidos em `%LOCALAPPDATA%\NexusAgent\config.json`, que o Agent lê sozinho (ver `src/config.ts`; variável de ambiente, se definida, ainda tem prioridade sobre isso).

A saída do processo (logs) fica em `%LOCALAPPDATA%\NexusAgent\agent.log` (e `agent.err.log` para erros), útil para diagnosticar sem precisar rodar na mão de novo.

Para remover tudo (autostart, processo, arquivos):

```powershell
.\uninstall.ps1
```

Isso ainda não é um "serviço do Windows" de verdade (não inicia antes de qualquer login, ex.: numa máquina que reinicia sem ninguém logar) — é autostart por usuário via pasta Inicializar, o que cobre o caso comum (PC de mesa/notebook de uso pessoal ou corporativo, onde alguém sempre faz login). Virar um serviço real (`Local System`, inicia no boot sem login) é um passo futuro, se necessário.

## Sem instalação permanente (rodando manualmente, uma vez)

Sem o `install.ps1`, o `.exe` roda em primeiro plano (uma janela de terminal fica aberta) — útil para testar rapidamente antes de instalar de vez.
