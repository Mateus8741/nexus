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
  4. Registra uma Tarefa Agendada do Windows (Task Scheduler) que dispara
     esse launcher no login deste usuário, e já inicia agora mesmo.

  Não precisa rodar como Administrador — tudo fica dentro da pasta do
  usuário atual e a tarefa roda com os privilégios normais dele.

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
Set-Content -Path $configPath -Value $config -Encoding UTF8

$logPath = Join-Path $installDir "agent.log"
$vbsPath = Join-Path $installDir "launcher.vbs"
$vbsContent = @(
    'Set objShell = CreateObject("WScript.Shell")'
    ('objShell.Run "cmd /c ""{0}"" >> ""{1}"" 2>&1", 0, False' -f $exeDest, $logPath)
)
Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII

$taskName = "NexusAgent"
schtasks /Create /F /SC ONLOGON /TN $taskName /TR "wscript.exe `"$vbsPath`"" /RL LIMITED | Out-Null

# Inicia agora, sem esperar o próximo login
Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`""

Write-Host ""
Write-Host "Nexus Agent instalado e rodando em segundo plano."
Write-Host "Vai iniciar sozinho sempre que $env:USERNAME fizer login neste PC — não precisa mais rodar comando nenhum."
Write-Host "Log em: $logPath"
Write-Host "Para desinstalar: rode uninstall.ps1 (mesma pasta deste script)."
