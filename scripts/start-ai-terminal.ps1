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

Set-Location -LiteralPath $AppRoot
Write-Host ''
Write-Host 'Marika AI ready.'
if ($VaultRoot) {
  Write-Host "Vault ativo: $VaultRoot"
}

$guidePath = Join-Path $AppRoot 'comandos.md'

Write-Host ''
Write-Host 'Resumo rápido:'
Write-Host '- /guide: abre o guia completo no app'
Write-Host '- /context: mostra o contexto do vault'
Write-Host '- /preview: gera o preview da organização'

if (Test-Path -LiteralPath $guidePath) {
  Write-Host ''
  Write-Host 'Use o botão Guia no app para ver a lista completa.'
}
