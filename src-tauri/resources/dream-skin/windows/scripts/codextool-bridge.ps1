[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Apply')]
  [string]$Action,

  [ValidateSet('preset-gothic-void-crusade', 'preset-aurora-observatory', 'preset-crystal-horizon', 'preset-rose-synthesis')]
  [string]$ThemeId = 'preset-gothic-void-crusade'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

$StateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$operationLock = Enter-DreamSkinOperationLock
try {
  $paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  Ensure-DreamSkinManagedDirectory -Path $paths.Saved -Root $paths.Root

  $themeDirectory = Join-Path $paths.Saved $ThemeId
  if (-not (Test-Path -LiteralPath $themeDirectory -PathType Container)) {
    throw "The selected built-in theme is not installed: $ThemeId"
  }

  $result = Use-DreamSkinSavedTheme -ThemeDirectory $themeDirectory -StateRoot $StateRoot
  Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot | Out-Null
  [pscustomobject]@{
    action = $Action
    themeId = "$($result.Theme.id)"
    themeName = "$($result.Theme.name)"
  } | ConvertTo-Json -Compress
} finally {
  Exit-DreamSkinOperationLock -Mutex $operationLock
}
