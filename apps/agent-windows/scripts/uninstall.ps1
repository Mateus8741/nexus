<#
.SYNOPSIS
  Remove o Nexus Agent instalado por install.ps1: para o processo, apaga a
  Tarefa Agendada e apaga a pasta de instalação.
#>

$ErrorActionPreference = "SilentlyContinue"

$taskName = "NexusAgent"
$installDir = Join-Path $env:LOCALAPPDATA "NexusAgent"
$exeDest = Join-Path $installDir "nexus-agent-windows.exe"

schtasks /Delete /TN $taskName /F | Out-Null

Get-Process -Name "nexus-agent-windows" | Where-Object {
    $_.Path -eq $exeDest
} | Stop-Process -Force

if (Test-Path $installDir) {
    Remove-Item -Recurse -Force $installDir
}

Write-Host "Nexus Agent removido: tarefa agendada, processo e arquivos em $installDir."
