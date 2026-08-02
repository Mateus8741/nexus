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

## Instalação permanente (inicia no boot, antes do login)

Pra não precisar abrir terminal toda vez, use `scripts/install.ps1`. No modo padrão (**Service**) ele:

1. Copia o `.exe` para `C:\ProgramData\NexusAgent\`
2. Grava `config.json` (URL do Core, nome, credenciais opcionais)
3. Cria a tarefa agendada **NexusAgent** com gatilho **no boot**, rodando como **SYSTEM** — sobe ao ligar o PC, **mesmo sem ninguém ter feito login** (mesmo espírito do AnyDesk)
4. Remove o atalho legado da pasta Inicializar (se existir)
5. Já inicia na hora

**Requer PowerShell como Administrador.** Copie `nexus-agent-windows.exe`, `install.ps1`, `uninstall.ps1` e `set-credentials.ps1` para a mesma pasta na máquina Windows:

```powershell
# Como Administrador:
.\install.ps1 -CoreUrl "wss://core.seudominio.com" -DeviceName "PC-da-Sala"
```

O instalador pede a **senha da conta Windows** (para AutoLogon / uso futuro). **Não use o PIN do Windows Hello** — ele fica no TPM e não pode ser reutilizado por outro programa. A senha é guardada criptografada com DPAPI (só esta máquina consegue ler).

```powershell
# Guardar senha + entrar sozinho após o boot (sessão interativa sem alguém na frente):
.\install.ps1 -CoreUrl "wss://core.seudominio.com" -EnableAutoLogon

# Sem guardar senha:
.\install.ps1 -CoreUrl "wss://core.seudominio.com" -SkipCredentials

# Trocar a senha depois:
.\set-credentials.ps1
```

Fallback **sem Admin** (só depois do login do usuário, pasta Inicializar — comportamento antigo):

```powershell
.\install.ps1 -CoreUrl "wss://core.seudominio.com" -Mode UserStartup
```

Logs: `C:\ProgramData\NexusAgent\agent.log` (modo Service) ou `%LOCALAPPDATA%\NexusAgent\agent.log` (UserStartup).

Desinstalar (como Admin se tiver instalado em modo Service):

```powershell
.\uninstall.ps1
```

## Sem instalação permanente (rodando manualmente, uma vez)

Sem o `install.ps1`, o `.exe` roda em primeiro plano (uma janela de terminal fica aberta) — útil para testar rapidamente antes de instalar de vez.
