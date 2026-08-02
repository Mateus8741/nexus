<#
.SYNOPSIS
  Instala o Nexus Agent para iniciar no boot (antes do login), como a
  conta SYSTEM — no mesmo espírito de AnyDesk/TeamViewer.

.DESCRIPTION
  Modo padrão (-Mode Service), exige Administrador:
  1. Copia o .exe para C:\ProgramData\NexusAgent\
  2. Grava config.json (Core URL, nome, credenciais opcionais)
  3. Cria uma Tarefa Agendada "NexusAgent" com gatilho AtStartup,
     rodando como SYSTEM (S-1-5-18), com reinício automático em falha
  4. Remove autostart legado da pasta Inicializar do usuário
  5. Inicia a tarefa agora

  Credenciais (senha da conta Windows): pedidas interativamente a menos
  que -SkipCredentials. NÃO use o PIN do Windows Hello — ele fica no TPM
  e não pode ser reutilizado por outro processo. Use a senha da conta
  local/Microsoft. A senha é criptografada com DPAPI LocalMachine e só
  descriptografa nesta máquina.

  -EnableAutoLogon: além de guardar a senha, configura o Windows para
  entrar sozinho nessa conta após o boot (útil quando precisa de sessão
  interativa sem alguém na frente do PC). Aviso: AutoLogon reduz a
  segurança física da máquina.

  -Mode UserStartup: fallback sem Admin (comportamento antigo — só após
  login do usuário, via pasta Inicializar).

.PARAMETER CoreUrl
  URL do Core (ws://IP:PORTA ou wss://dominio).

.PARAMETER DeviceName
  Nome de exibição no Dashboard. Padrão: nome do PC.

.PARAMETER Mode
  Service (padrão, boot SYSTEM) ou UserStartup (pasta Inicializar).

.PARAMETER Username
  Conta Windows cuja senha será guardada. Padrão: usuário atual.

.PARAMETER Password
  SecureString opcional; se omitido (e sem -SkipCredentials), pergunta.

.PARAMETER SkipCredentials
  Não pede nem grava senha.

.PARAMETER EnableAutoLogon
  Liga AutoAdminLogon do Windows com a credencial informada.

.EXAMPLE
  # PowerShell como Administrador:
  .\install.ps1 -CoreUrl "wss://core.seudominio.com" -DeviceName "PC-da-Sala"

.EXAMPLE
  .\install.ps1 -CoreUrl "ws://192.168.0.8:4700" -EnableAutoLogon
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$CoreUrl,

    [string]$DeviceName = $env:COMPUTERNAME,

    [ValidateSet("Service", "UserStartup")]
    [string]$Mode = "Service",

    [string]$Username = $env:USERNAME,

    [SecureString]$Password,

    [switch]$SkipCredentials,

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

function Stop-NexusAgentProcesses([string]$ExePath) {
    Get-Process -Name "nexus-agent-windows" -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $ExePath } |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function Remove-LegacyUserStartup {
    $startupDir = [Environment]::GetFolderPath("Startup")
    Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $startupDir "NexusAgent.lnk")
    Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $startupDir "NexusAgent.vbs")
}

function Set-WindowsAutoLogon([string]$User, [string]$PlainPassword) {
    $winlogon = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
    Set-ItemProperty -Path $winlogon -Name "AutoAdminLogon" -Value "1" -Type String
    Set-ItemProperty -Path $winlogon -Name "DefaultUserName" -Value $User -Type String
    Set-ItemProperty -Path $winlogon -Name "DefaultPassword" -Value $PlainPassword -Type String
    # Domínio vazio = conta local neste PC
    Set-ItemProperty -Path $winlogon -Name "DefaultDomainName" -Value $env:COMPUTERNAME -Type String
}

if ($Mode -eq "Service" -and -not (Test-IsAdministrator)) {
    Write-Error @"
Modo Service exige PowerShell como Administrador (botão direito → Executar como administrador).

Sem Admin, use o fallback pós-login:
  .\install.ps1 -CoreUrl `"$CoreUrl`" -DeviceName `"$DeviceName`" -Mode UserStartup
"@
    exit 1
}

if ($EnableAutoLogon -and $SkipCredentials) {
    Write-Error "-EnableAutoLogon precisa de credenciais (não use -SkipCredentials)."
    exit 1
}

$plainPassword = $null
$passwordProtected = $null

if (-not $SkipCredentials) {
    Write-Host ""
    Write-Host "Credencial da conta Windows (para AutoLogon / ações futuras que precisem desbloquear)."
    Write-Host "IMPORTANTE: use a SENHA da conta — o PIN do Windows Hello NÃO funciona aqui (fica no TPM)."
    Write-Host ""

    if (-not $Password) {
        $Password = Read-Host "Senha de '$Username'" -AsSecureString
    }
    if ($Password.Length -eq 0) {
        Write-Error "Senha vazia. Use -SkipCredentials se quiser instalar sem guardar senha."
        exit 1
    }

    $plainPassword = ConvertFrom-SecureStringToPlain $Password
    $passwordProtected = Protect-NexusSecret $plainPassword
}

# --- Pastas ---
if ($Mode -eq "Service") {
    $installDir = Join-Path $env:PROGRAMDATA "NexusAgent"
}
else {
    $installDir = Join-Path $env:LOCALAPPDATA "NexusAgent"
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$exeSource = Join-Path $PSScriptRoot "nexus-agent-windows.exe"
if (-not (Test-Path $exeSource)) {
    Write-Error "Não encontrei nexus-agent-windows.exe na mesma pasta deste script ($PSScriptRoot)."
    exit 1
}

$exeDest = Join-Path $installDir "nexus-agent-windows.exe"

# Para o processo antigo antes de sobrescrever o .exe (arquivo em uso).
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
schtasks /Delete /TN "NexusAgent" /F 2>$null | Out-Null
Unregister-ScheduledTask -TaskName "NexusAgent" -Confirm:$false -ErrorAction SilentlyContinue
Stop-NexusAgentProcesses $exeDest
# Também encerra cópia legada em LOCALAPPDATA, se existir
Stop-NexusAgentProcesses (Join-Path $env:LOCALAPPDATA "NexusAgent\nexus-agent-windows.exe")
$ErrorActionPreference = $previousErrorActionPreference

Start-Sleep -Milliseconds 400
Copy-Item -Path $exeSource -Destination $exeDest -Force

# Migra agent-id legado (~/.nexus ou LOCALAPPDATA) para a pasta nova, se ainda
# não existir — evita o Core ver um Device novo após reinstalação.
$agentIdDest = Join-Path $installDir "agent-id"
if (-not (Test-Path $agentIdDest)) {
    $legacyCandidates = @(
        (Join-Path $env:USERPROFILE ".nexus\agent-id"),
        (Join-Path $env:LOCALAPPDATA "NexusAgent\agent-id")
    )
    foreach ($candidate in $legacyCandidates) {
        if (Test-Path $candidate) {
            Copy-Item -Path $candidate -Destination $agentIdDest -Force
            break
        }
    }
}

$config = [ordered]@{
    coreUrl    = $CoreUrl
    deviceName = $DeviceName
}

if ($passwordProtected) {
    $config.credentials = [ordered]@{
        username          = $Username
        domain            = "."
        passwordProtected = $passwordProtected
    }
}

if ($EnableAutoLogon) {
    if (-not $plainPassword) {
        Write-Error "AutoLogon exige senha."
        exit 1
    }
    Set-WindowsAutoLogon -User $Username -PlainPassword $plainPassword
    $config.autoLogon = $true
    Write-Host "AutoLogon habilitado para '$Username' (próximo boot entra sozinho nessa conta)."
}

$configPath = Join-Path $installDir "config.json"
Write-Utf8NoBom $configPath ($config | ConvertTo-Json -Depth 5)

# Limpa senha em memória o quanto antes
$plainPassword = $null
$Password = $null
[GC]::Collect()

Remove-LegacyUserStartup

$logPath = Join-Path $installDir "agent.log"
$errLogPath = Join-Path $installDir "agent.err.log"

if ($Mode -eq "Service") {
    # Wrapper PowerShell: redireciona stdout/stderr (o .exe sozinho não
    # anexa logs úteis quando lançado pela Task Scheduler) e deixa a
    # tarefa SYSTEM só cuidar do ciclo de vida.
    $launcherPath = Join-Path $installDir "launcher.ps1"
    $launcherContent = @"
`$ErrorActionPreference = 'Continue'
`$exe = '$exeDest'
`$out = '$logPath'
`$err = '$errLogPath'
Set-Location '$installDir'
& `$exe 1>> `$out 2>> `$err
"@
    Write-Utf8NoBom $launcherPath $launcherContent

    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`"" `
        -WorkingDirectory $installDir

    $trigger = New-ScheduledTaskTrigger -AtStartup

    $principal = New-ScheduledTaskPrincipal `
        -UserId "SYSTEM" `
        -LogonType ServiceAccount `
        -RunLevel Highest

    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 999 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -MultipleInstances IgnoreNew

    Register-ScheduledTask `
        -TaskName "NexusAgent" `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description "Nexus Agent — inicia no boot (SYSTEM), antes do login do usuário." `
        -Force | Out-Null

    Start-ScheduledTask -TaskName "NexusAgent"

    Write-Host ""
    Write-Host "Nexus Agent instalado como tarefa de boot (SYSTEM)."
    Write-Host "Inicia ao ligar o PC, mesmo sem ninguém ter feito login."
    Write-Host "Pasta: $installDir"
    Write-Host "Log:   $logPath"
    if ($passwordProtected) {
        Write-Host "Credencial de '$Username' guardada (DPAPI LocalMachine)."
        Write-Host "Para trocar a senha depois: .\set-credentials.ps1"
    }
    Write-Host "Desinstalar (como Admin): .\uninstall.ps1"
}
else {
    $launcherPath = Join-Path $installDir "launcher.ps1"
    $launcherContent = (
        'Start-Process -FilePath "{0}" -WindowStyle Hidden -RedirectStandardOutput "{1}" -RedirectStandardError "{2}"' -f $exeDest, $logPath, $errLogPath
    )
    Write-Utf8NoBom $launcherPath $launcherContent

    $launcherArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""
    $startupDir = [Environment]::GetFolderPath("Startup")
    $shortcutPath = Join-Path $startupDir "NexusAgent.lnk"
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = $launcherArgs
    $shortcut.WorkingDirectory = $installDir
    $shortcut.Save()

    Start-Process -FilePath "powershell.exe" -ArgumentList $launcherArgs -WindowStyle Hidden

    Write-Host ""
    Write-Host "Nexus Agent instalado em modo UserStartup (após login de $env:USERNAME)."
    Write-Host "Para iniciar antes do login, rode de novo como Admin sem -Mode UserStartup."
    Write-Host "Log em: $logPath"
}
