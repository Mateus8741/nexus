<#
.SYNOPSIS
  Remove o Nexus Agent instalado por install.ps1: para o processo, remove
  o autostart (pasta Inicializar) e apaga a pasta de instalação.
#>

$ErrorActionPreference = "SilentlyContinue"

$installDir = Join-Path $env:LOCALAPPDATA "NexusAgent"
$exeDest = Join-Path $installDir "nexus-agent-windows.exe"

# Versões anteriores deste instalador usavam Tarefa Agendada e/ou um
# launcher .vbs em vez do atalho .lnk atual — tentar remover os três não
# faz mal se algum não existir.
schtasks /Delete /TN "NexusAgent" /F | Out-Null

$startupDir = [Environment]::GetFolderPath("Startup")
Remove-Item -Force (Join-Path $startupDir "NexusAgent.vbs")
Remove-Item -Force (Join-Path $startupDir "NexusAgent.lnk")

Get-Process -Name "nexus-agent-windows" | Where-Object {
    $_.Path -eq $exeDest
} | Stop-Process -Force

if (Test-Path $installDir) {
    Remove-Item -Recurse -Force $installDir
}

Write-Host "Nexus Agent removido: autostart, processo e arquivos em $installDir."
