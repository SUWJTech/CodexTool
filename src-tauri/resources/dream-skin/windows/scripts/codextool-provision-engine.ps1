[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$SkillRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

$StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$operationLock = Enter-DreamSkinOperationLock
try {
  # Startup only provisions the self-contained runtime and validated theme
  # store. Codex and config.toml remain untouched until an explicit Apply.
  $engine = Install-DreamSkinRuntimeEngine -SkillRoot $SkillRoot -StateRoot $StateRoot
  $null = Initialize-DreamSkinThemeStore -SkillRoot $engine.Root -StateRoot $StateRoot
} finally {
  Exit-DreamSkinOperationLock -Mutex $operationLock
}
