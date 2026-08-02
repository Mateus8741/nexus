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
  3. Gera um pequeno "launcher" (.vbs) que roda o Agent com a janela do
     console escondida, redirecionando toda a saída para agent.log (útil
     para diagnosticar problema sem precisar rodar na mão de novo).
  4. Copia esse launcher para a pasta "Inicializar" (Startup) do usuário
     atual — o Windows roda automaticamente qualquer coisa ali sempre que
     esse usuário faz login — e já inicia agora mesmo, sem esperar o
     próximo login.

  Não precisa rodar como Administrador nem depende do Task Scheduler:
  tudo fica dentro da pasta do próprio usuário (%LOCALAPPDATA% e a pasta
  Startup dele), então funciona mesmo em PCs corporativos/gerenciados que
  bloqueiam a criação de Tarefas Agendadas por política de grupo.

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

$logPath = Join-Path $installDir "agent.log"
$vbsPath = Join-Path $installDir "launcher.vbs"
$vbsContent = @(
    'Set objShell = CreateObject("WScript.Shell")'
    ('objShell.Run "cmd /c ""{0}"" >> ""{1}"" 2>&1", 0, False' -f $exeDest, $logPath)
)
Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

# Pasta "Inicializar" do usuário atual (%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup)
# — o Windows executa automaticamente qualquer coisa ali no login deste
# usuário. Não depende do Task Scheduler nem de nenhuma permissão especial;
# funciona mesmo em PCs corporativos que bloqueiam Tarefas Agendadas.
$startupDir = [Environment]::GetFolderPath("Startup")
$startupLauncher = Join-Path $startupDir "NexusAgent.vbs"
Copy-Item -Path $vbsPath -Destination $startupLauncher -Force

# Inicia agora, sem esperar o próximo login
Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`""

Write-Host ""
Write-Host "Nexus Agent instalado e rodando em segundo plano."
Write-Host "Vai iniciar sozinho sempre que $env:USERNAME fizer login neste PC (via pasta Inicializar) — não precisa mais rodar comando nenhum."
Write-Host "Log em: $logPath"
Write-Host "Para desinstalar: rode uninstall.ps1 (mesma pasta deste script)."
