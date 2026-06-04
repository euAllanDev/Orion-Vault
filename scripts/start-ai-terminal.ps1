param(
  [string]$AppRoot,
  [string]$VaultRoot,
  [string]$NodePath
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
  $VaultRoot = $env:ORION_VAULT_ROOT
}

if (-not $NodePath) {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    $NodePath = $nodeCommand.Source
  }
}

$tsxCliPath = Join-Path $AppRoot 'node_modules/tsx/dist/cli.mjs'
$cliEntryPath = Join-Path $AppRoot 'interfaces/cli/main.ts'

if ($VaultRoot) {
  New-Item -ItemType Directory -Force -Path $VaultRoot | Out-Null
  $env:ORION_VAULT_ROOT = $VaultRoot
  Set-Location -LiteralPath $VaultRoot
} else {
  Set-Location -LiteralPath $AppRoot
}

function orion {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  if (-not $NodePath) {
    throw 'NodePath indisponivel para iniciar a CLI do Orion Vault.'
  }

  & $NodePath $tsxCliPath $cliEntryPath @Arguments
}

Write-Host ''
Write-Host 'Orion Vault AI ready.'
Write-Host 'Orion Vault e um app de notas local-first adaptado para IA e agentes.'
if ($VaultRoot) {
  Write-Host "Vault ativo: $VaultRoot"
}
Write-Host "Helper: orion"

$onboarding = $null
try {
  $onboardingRaw = (orion /onboarding | Out-String).Trim()
  if ($onboardingRaw) {
    $onboarding = $onboardingRaw | ConvertFrom-Json
  }
} catch {
  $onboarding = $null
}

Write-Host ''
Write-Host 'Resumo rapido:'
if ($onboarding -and $onboarding.commandLines) {
  foreach ($line in $onboarding.commandLines) {
    Write-Host "- $line"
  }
  Write-Host ''
  Write-Host 'Se a pergunta for sobre o app em si: use orion /product-context.'
  Write-Host ''
  if ($onboarding.policyLines) {
    foreach ($line in $onboarding.policyLines) {
      Write-Host "- $line"
    }
    Write-Host ''
  }
  Write-Host $onboarding.statusText
} else {
  Write-Host '- orion /start'
  Write-Host '- orion /guide'
  Write-Host '- orion /skills'
  Write-Host '- orion /context'
  Write-Host '- orion /preview'
  Write-Host '- orion /apply --preview-id <id>'
}
