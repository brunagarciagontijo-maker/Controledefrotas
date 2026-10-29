# Preparacao LOCAL. Sem instalacao, rede, credenciais, servicos ou backup.
# Sem parametro: somente apresenta a estrutura. Criacao exige aprovacao previa.
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param([switch]$CreatePrivateDirectories)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'LOCALAPPDATA indisponivel.' }
$stationRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'SistemaPortariaBackup'))
$stationRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')).TrimEnd('\')
$stationFolders = @('credentials', 'tools', 'archives', 'staging', 'staging\database',
    'staging\storage', 'staging\storage\objects', 'staging\manifests',
    'staging\verification', 'staging\logs', 'lab', 'lab\bootstrap', 'lab\evidence')
$stationResult = [ordered]@{
    root = '%LOCALAPPDATA%\SistemaPortariaBackup'
    folders = $stationFolders
    privateDirectoriesCreated = $false
    aclVerified = $false
    encryptionConfigured = $false
    backupExists = $false
    restoreVerified = $false
}
if (-not $CreatePrivateDirectories) {
    $stationResult | ConvertTo-Json -Depth 3
    return
}

# Protege contra destino compartilhado, redirecionado ou pertencente ao repo.
if ($stationRoot.StartsWith('\\') -or $stationRoot -notmatch '^[A-Za-z]:\\' -or
    $stationRoot -match '(?i)(onedrive|sharepoint|dropbox|google drive)' -or
    $stationRoot.Equals($stationRepository, [StringComparison]::OrdinalIgnoreCase) -or
    $stationRoot.StartsWith($stationRepository + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Destino local privado fora de sincronizacao/repo obrigatorio.'
}
foreach ($stationSyncRoot in @($env:OneDrive, $env:OneDriveCommercial, $env:OneDriveConsumer)) {
    if (-not [string]::IsNullOrWhiteSpace($stationSyncRoot)) {
        $stationSyncPath = [IO.Path]::GetFullPath($stationSyncRoot).TrimEnd('\')
        if ($stationRoot.Equals($stationSyncPath, [StringComparison]::OrdinalIgnoreCase) -or
            $stationRoot.StartsWith($stationSyncPath + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Destino sincronizado recusado.'
        }
    }
}
$stationDrive = New-Object IO.DriveInfo ([IO.Path]::GetPathRoot($stationRoot))
if ($stationDrive.DriveType -ne [IO.DriveType]::Fixed -or $stationDrive.DriveFormat -ne 'NTFS') {
    throw 'Volume local NTFS obrigatorio.'
}
$stationPsDrive = Get-PSDrive -Name $stationRoot.Substring(0, 1) -PSProvider FileSystem
if (-not [string]::IsNullOrWhiteSpace($stationPsDrive.DisplayRoot)) { throw 'Volume mapeado recusado.' }
$stationAncestor = Split-Path -Parent $stationRoot
while (-not [string]::IsNullOrWhiteSpace($stationAncestor)) {
    $stationItem = Get-Item -LiteralPath $stationAncestor -Force
    if (($stationItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Destino com junction/link recusado.'
    }
    $stationAncestor = Split-Path -Parent $stationAncestor
}
if (Test-Path -LiteralPath $stationRoot) {
    throw 'Destino ja existe: revisar separadamente; este preparador nunca altera pastas existentes.'
}
if (-not $PSCmdlet.ShouldProcess('%LOCALAPPDATA%\SistemaPortariaBackup', 'Criar apenas pastas vazias com ACL privada')) {
    $stationResult | ConvertTo-Json -Depth 3
    return
}

# ACL somente da NOVA pasta. Nunca modifica Windows, perfil ou ACL do pai.
# Administradores/SYSTEM continuam com acesso; ACL nao protege de malware no usuario.
$stationUser = [Security.Principal.WindowsIdentity]::GetCurrent().User
$stationAllowed = @($stationUser.Value, 'S-1-5-18', 'S-1-5-32-544') | Select-Object -Unique
$stationAcl = New-Object Security.AccessControl.DirectorySecurity
$stationAcl.SetAccessRuleProtection($true, $false)
$stationAcl.SetOwner($stationUser)
foreach ($stationSid in $stationAllowed) {
    $stationPrincipal = New-Object Security.Principal.SecurityIdentifier $stationSid
    $stationRule = New-Object Security.AccessControl.FileSystemAccessRule(
        $stationPrincipal, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
    $stationAcl.AddAccessRule($stationRule)
}
try {
    [void][IO.Directory]::CreateDirectory($stationRoot)
    Set-Acl -LiteralPath $stationRoot -AclObject $stationAcl
    $stationEffectiveAcl = Get-Acl -LiteralPath $stationRoot
    $stationEffectiveRules = @($stationEffectiveAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    if (-not $stationEffectiveAcl.AreAccessRulesProtected -or
        $stationEffectiveAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $stationUser.Value -or
        @($stationEffectiveRules | Where-Object { $_.AccessControlType -eq 'Allow' -and $stationAllowed -notcontains $_.IdentityReference.Value }).Count -gt 0) {
        throw 'ACL nao validada.'
    }
    foreach ($stationFolder in $stationFolders) {
        $stationChild = Join-Path $stationRoot $stationFolder
        [void][IO.Directory]::CreateDirectory($stationChild)
        $stationChildAcl = Get-Acl -LiteralPath $stationChild
        $stationChildRules = @($stationChildAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
        if (@($stationChildRules | Where-Object { $_.AccessControlType -eq 'Allow' -and $stationAllowed -notcontains $_.IdentityReference.Value }).Count -gt 0) {
            throw 'ACL filha nao validada.'
        }
    }
    $stationResult.privateDirectoriesCreated = $true
    $stationResult.aclVerified = $true
    $stationResult | ConvertTo-Json -Depth 3
} catch {
    # Sem remocao automatica: pode haver pastas vazias parciais a revisar.
    throw 'Preparo incompleto; nao colocar dados aqui. Revisar pastas/ACL localmente. Nenhum backup foi realizado.'
}
