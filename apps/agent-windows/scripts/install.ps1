<#
.SYNOPSIS
  Instala o Nexus Agent para rodar sozinho, em segundo plano, sempre que
  este usuário fizer login no Windows — sem precisar abrir terminal nenhum
  depois desta primeira vez.

.DESCRIPTION
  1. Copia nexus-agent-windows.exe (esperado na mesma pasta deste script)
     para %LOCALAPPDATA%\NexusAgent\.
  2. Grava NEXUS_CORE_URL/NEXUS_DEVICE_NAME em config.json nessa mesma
     pasta — o Agent lê esse arquivo automaticamente (ver src/config.ts),
     então não é preciso setar variável de ambiente nenhuma depois.
  3. Gera launcher.ps1, um script PowerShell puro que roda o Agent com a
     janela do console escondida (via Start-Process -WindowStyle Hidden),
     redirecionando toda a saída para agent.log/agent.err.log.
  4. Cria um atalho (.lnk) na pasta "Inicializar" (Startup) do usuário
     atual apontando pro PowerShell rodando esse launcher, escondido — o
     Windows executa automaticamente qualquer coisa ali no login. Já
     inicia agora mesmo também, sem esperar o próximo login.

  Não precisa rodar como Administrador, não depende do Task Scheduler nem
  do Windows Script Host (wscript.exe/cscript.exe) — só PowerShell puro e
  a pasta Inicializar do próprio usuário. Isso importa porque PCs
  corporativos/gerenciados costumam bloquear Tarefas Agendadas e/ou
  Windows Script Host por política de grupo (foi exatamente o que
  aconteceu na primeira versão deste instalador — ver ARCHITECTURE.md
  seção 17).

.PARAMETER CoreUrl
  URL do Core (ws://IP:PORTA para rede local, wss://dominio para nuvem).

.PARAMETER DeviceName
  Nome de exibição do dispositivo no Dashboard. Padrão: nome do PC.

.EXAMPLE
  .\install.ps1 -CoreUrl "wss://core.seudominio.com" -DeviceName "PC-da-Sala"

.EXAMPLE
  .\install.ps1 -CoreUrl "ws://192.168.0.8:4700"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$CoreUrl,

    [string]$DeviceName = $env:COMPUTERNAME
)

$ErrorActionPreference = "Stop"

$installDir = Join-Path $env:LOCALAPPDATA "NexusAgent"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$exeSource = Join-Path $PSScriptRoot "nexus-agent-windows.exe"
if (-not (Test-Path $exeSource)) {
    Write-Error "Não encontrei nexus-agent-windows.exe na mesma pasta deste script ($PSScriptRoot). Coloque o .exe ao lado do install.ps1 e rode de novo."
    exit 1
}

$exeDest = Join-Path $installDir "nexus-agent-windows.exe"
Copy-Item -Path $exeSource -Destination $exeDest -Force

$configPath = Join-Path $installDir "config.json"
$config = @{ coreUrl = $CoreUrl; deviceName = $DeviceName } | ConvertTo-Json
# NÃO usar `Set-Content -Encoding UTF8` aqui: no Windows PowerShell 5.1 (o
# `powershell.exe` embutido) isso grava um BOM UTF-8 no início do arquivo,
# que quebra o `JSON.parse` do lado do Agent (Node/Bun não descartam BOM
# automaticamente). `[System.Text.UTF8Encoding]::new($false)` escreve UTF-8
# sem BOM.
[System.IO.File]::WriteAllText($configPath, $config, [System.Text.UTF8Encoding]::new($false))

# Limpa artefatos de versões anteriores deste instalador (Tarefa Agendada
# e launcher .vbs) — não faz mal se não existirem. `schtasks` escreve
# direto no stderr quando a tarefa não existe, e com `$ErrorActionPreference
# = "Stop"` isso vira um erro que interrompe o script inteiro — por isso o
# rebaixamento temporário abaixo, só para este trecho "melhor esforço".
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
schtasks /Delete /TN "NexusAgent" /F 2>$null | Out-Null
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $installDir "launcher.vbs")
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path ([Environment]::GetFolderPath("Startup")) "NexusAgent.vbs")
$ErrorActionPreference = $previousErrorActionPreference

$logPath = Join-Path $installDir "agent.log"
$errLogPath = Join-Path $installDir "agent.err.log"

# Launcher em PowerShell puro (sem Windows Script Host): Start-Process
# -WindowStyle Hidden esconde a janela do processo iniciado nativamente,
# sem envolver wscript.exe/cscript.exe.
$launcherPath = Join-Path $installDir "launcher.ps1"
$launcherContent = (
    'Start-Process -FilePath "{0}" -WindowStyle Hidden -RedirectStandardOutput "{1}" -RedirectStandardError "{2}"' -f $exeDest, $logPath, $errLogPath
)
[System.IO.File]::WriteAllText($launcherPath, $launcherContent, [System.Text.UTF8Encoding]::new($false))

$launcherArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""

# Atalho (.lnk) na pasta "Inicializar" do usuário atual, apontando pro
# PowerShell rodando launcher.ps1 escondido. `New-Object -ComObject
# WScript.Shell` aqui só instancia um componente COM dentro do próprio
# processo do PowerShell — não inicia wscript.exe/cscript.exe como
# processo separado, então não é afetado por uma política que bloqueie
# especificamente esses dois executáveis.
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "NexusAgent.lnk"
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = $launcherArgs
$shortcut.WorkingDirectory = $installDir
$shortcut.Save()

# Inicia agora, sem esperar o próximo login. Um novo processo powershell.exe
# escondido, independente deste terminal — fechar este terminal não deve
# derrubar o Agent (diferente de rodar o .exe direto na mão).
Start-Process -FilePath "powershell.exe" -ArgumentList $launcherArgs -WindowStyle Hidden

Write-Host ""
Write-Host "Nexus Agent instalado e rodando em segundo plano."
Write-Host "Vai iniciar sozinho sempre que $env:USERNAME fizer login neste PC (via pasta Inicializar) — não precisa mais rodar comando nenhum."
Write-Host "Log em: $logPath (e $errLogPath para erros)"
Write-Host "Para desinstalar: rode uninstall.ps1 (mesma pasta deste script)."
