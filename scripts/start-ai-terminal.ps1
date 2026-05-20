param(
  [string]$AppRoot,
  [string]$VaultRoot
)

$ErrorActionPreference = 'Stop'

try {
  chcp 65001 | Out-Null
} catch {
  # ignore code page changes when unavailable
}

try {
  [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {
  # ignore encoding setup failures
}

if (-not $AppRoot) {
  $AppRoot = $PSScriptRoot | Split-Path -Parent
}

if (-not $VaultRoot) {
  $VaultRoot = $env:MARIKA_VAULT_ROOT
}

if ($VaultRoot) {
  New-Item -ItemType Directory -Force -Path $VaultRoot | Out-Null
  $env:MARIKA_VAULT_ROOT = $VaultRoot
  Set-Location -LiteralPath $VaultRoot
} else {
  Set-Location -LiteralPath $AppRoot
}

function marika {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & pnpm --dir $AppRoot exec tsx (Join-Path $AppRoot 'interfaces/cli/main.ts') @Arguments
}

Write-Host ''
Write-Host 'Marika AI ready.'
if ($VaultRoot) {
  Write-Host "Vault ativo: $VaultRoot"
}
Write-Host "Helper: marika"

$guidePath = Join-Path $AppRoot 'comandos.md'

Write-Host ''
Write-Host 'Resumo rápido:'
Write-Host '- marika /start: abre a orientacao inicial da IA para este app'
Write-Host '- marika /guide: abre o guia completo do produto'
Write-Host '- marika /context: mostra o contexto do vault em JSON estruturado'
Write-Host '- marika /preview: gera o preview da organizacao em JSON estruturado'
Write-Host '- marika /apply --preview-id <id>: aplica somente um preview validado'

if (Test-Path -LiteralPath $guidePath) {
  Write-Host ''
  Write-Host 'Use marika /guide ou o botão Guia no app para ver a lista completa.'
}
