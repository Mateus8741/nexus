<#
.SYNOPSIS
  Remove o Nexus Agent: tarefa de boot / Startup, processo, arquivos e
  (se Admin) AutoLogon que o instalador tenha ligado.
#>

$ErrorActionPreference = "SilentlyContinue"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Clear-WindowsAutoLogonIfOurs([string]$ConfigPath) {
    if (-not (Test-Path $ConfigPath)) { return }
    try {
        $raw = [System.IO.File]::ReadAllText($ConfigPath)
        if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) { $raw = $raw.Substring(1) }
        $config = $raw | ConvertFrom-Json
        if ($config.autoLogon -ne $true) { return }
    }
    catch {
        return
    }

    if (-not (Test-IsAdministrator)) {
        Write-Host "AutoLogon estava ligado por este Agent, mas desinstalar sem Admin não remove as chaves Winlogon. Rode uninstall.ps1 como Administrador para limpar."
        return
    }

    $winlogon = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
    Set-ItemProperty -Path $winlogon -Name "AutoAdminLogon" -Value "0" -Type String -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path $winlogon -Name "DefaultPassword" -ErrorAction SilentlyContinue
    Write-Host "AutoLogon (Winlogon) desligado."
}

$machineDir = Join-Path $env:PROGRAMDATA "NexusAgent"
$userDir = Join-Path $env:LOCALAPPDATA "NexusAgent"

Clear-WindowsAutoLogonIfOurs (Join-Path $machineDir "config.json")
Clear-WindowsAutoLogonIfOurs (Join-Path $userDir "config.json")

# Tarefa de boot (Service) e resíduos de versões antigas
Unregister-ScheduledTask -TaskName "NexusAgent" -Confirm:$false -ErrorAction SilentlyContinue
schtasks /Delete /TN "NexusAgent" /F 2>$null | Out-Null

$startupDir = [Environment]::GetFolderPath("Startup")
Remove-Item -Force (Join-Path $startupDir "NexusAgent.vbs")
Remove-Item -Force (Join-Path $startupDir "NexusAgent.lnk")

Get-Process -Name "nexus-agent-windows" -ErrorAction SilentlyContinue | Stop-Process -Force

foreach ($dir in @($machineDir, $userDir)) {
    if (Test-Path $dir) {
        Remove-Item -Recurse -Force $dir
        Write-Host "Removido: $dir"
    }
}

Write-Host "Nexus Agent desinstalado (tarefa de boot, Startup e arquivos)."
