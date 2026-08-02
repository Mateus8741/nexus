<#
.SYNOPSIS
  Atualiza (ou remove) a senha da conta Windows guardada pelo Nexus Agent.

.DESCRIPTION
  A senha é criptografada com DPAPI LocalMachine no config.json do Agent.
  Não use o PIN do Windows Hello — só a senha da conta.

.PARAMETER Username
  Conta Windows. Padrão: usuário atual (ou o já salvo no config).

.PARAMETER Password
  SecureString opcional; se omitido, pergunta.

.PARAMETER Clear
  Remove as credenciais do config (e desliga AutoLogon se estiver ligado
  por nós, quando rodado como Admin).

.PARAMETER EnableAutoLogon
  Além de guardar, liga AutoAdminLogon do Windows.

.EXAMPLE
  .\set-credentials.ps1

.EXAMPLE
  .\set-credentials.ps1 -Clear
#>

param(
    [string]$Username,
    [SecureString]$Password,
    [switch]$Clear,
    [switch]$EnableAutoLogon
)

$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Protect-NexusSecret([string]$PlainText) {
    Add-Type -AssemblyName System.Security
    $bytes = [Text.Encoding]::UTF8.GetBytes($PlainText)
    $protected = [Security.Cryptography.ProtectedData]::Protect(
        $bytes,
        $null,
        [Security.Cryptography.DataProtectionScope]::LocalMachine
    )
    return [Convert]::ToBase64String($protected)
}

function ConvertFrom-SecureStringToPlain([SecureString]$Secure) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Clear-WindowsAutoLogon {
    $winlogon = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
    if (-not (Test-Path $winlogon)) { return }
    Set-ItemProperty -Path $winlogon -Name "AutoAdminLogon" -Value "0" -Type String -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path $winlogon -Name "DefaultPassword" -ErrorAction SilentlyContinue
}

function Set-WindowsAutoLogon([string]$User, [string]$PlainPassword) {
    $winlogon = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
    Set-ItemProperty -Path $winlogon -Name "AutoAdminLogon" -Value "1" -Type String
    Set-ItemProperty -Path $winlogon -Name "DefaultUserName" -Value $User -Type String
    Set-ItemProperty -Path $winlogon -Name "DefaultPassword" -Value $PlainPassword -Type String
    Set-ItemProperty -Path $winlogon -Name "DefaultDomainName" -Value $env:COMPUTERNAME -Type String
}

$candidates = @(
    (Join-Path $env:PROGRAMDATA "NexusAgent\config.json"),
    (Join-Path $env:LOCALAPPDATA "NexusAgent\config.json")
)

$configPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $configPath) {
    Write-Error "Não encontrei config.json do Nexus Agent. Instale com install.ps1 antes."
    exit 1
}

$raw = [System.IO.File]::ReadAllText($configPath)
if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) {
    $raw = $raw.Substring(1)
}
$config = $raw | ConvertFrom-Json

if ($Clear) {
    if ($config.PSObject.Properties.Name -contains "credentials") {
        $config.PSObject.Properties.Remove("credentials")
    }
    if ($config.PSObject.Properties.Name -contains "autoLogon") {
        $config.PSObject.Properties.Remove("autoLogon")
    }
    if (Test-IsAdministrator) {
        Clear-WindowsAutoLogon
    }
    Write-Utf8NoBom $configPath ($config | ConvertTo-Json -Depth 5)
    Write-Host "Credenciais removidas de $configPath."
    exit 0
}

if (-not $Username) {
    if ($config.credentials -and $config.credentials.username) {
        $Username = [string]$config.credentials.username
    }
    else {
        $Username = $env:USERNAME
    }
}

Write-Host "Conta: $Username"
Write-Host "Use a SENHA da conta (não o PIN do Windows Hello)."
if (-not $Password) {
    $Password = Read-Host "Nova senha" -AsSecureString
}
if ($Password.Length -eq 0) {
    Write-Error "Senha vazia."
    exit 1
}

$plain = ConvertFrom-SecureStringToPlain $Password
$protected = Protect-NexusSecret $plain

$config | Add-Member -NotePropertyName credentials -NotePropertyValue ([pscustomobject]@{
        username          = $Username
        domain            = "."
        passwordProtected = $protected
    }) -Force

if ($EnableAutoLogon) {
    if (-not (Test-IsAdministrator)) {
        Write-Error "-EnableAutoLogon exige Administrador."
        exit 1
    }
    Set-WindowsAutoLogon -User $Username -PlainPassword $plain
    $config | Add-Member -NotePropertyName autoLogon -NotePropertyValue $true -Force
    Write-Host "AutoLogon habilitado para '$Username'."
}

Write-Utf8NoBom $configPath ($config | ConvertTo-Json -Depth 5)

$plain = $null
$Password = $null
[GC]::Collect()

Write-Host "Credencial atualizada em $configPath (DPAPI LocalMachine)."
