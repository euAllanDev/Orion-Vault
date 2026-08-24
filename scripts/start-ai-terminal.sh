#!/bin/sh
set -eu

app_root=''
vault_root=''
node_path=''
opencode_path=''
claude_code_path=''
agent_prompt=''

while [ "$#" -gt 0 ]; do
  case "$1" in
    --app-root) app_root="$2"; shift 2 ;;
    --vault-root) vault_root="$2"; shift 2 ;;
    --node-path) node_path="$2"; shift 2 ;;
    --opencode-path) opencode_path="$2"; shift 2 ;;
    --claude-code-path) claude_code_path="$2"; shift 2 ;;
    --agent-prompt) agent_prompt="$2"; shift 2 ;;
    *) echo "Orion Vault: argumento desconhecido: $1" >&2; exit 1 ;;
  esac
done

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app_root=${app_root:-$(CDPATH= cd -- "$script_dir/.." && pwd)}
vault_root=${vault_root:-${ORION_VAULT_ROOT:-}}
node_path=${node_path:-${ORION_NODE_PATH:-$(command -v node || true)}}

if [ -z "$node_path" ]; then
  echo 'Orion Vault: Node.js nao encontrado. Instale Node.js 20+.' >&2
  exit 1
fi

if [ -n "$vault_root" ]; then
  mkdir -p "$vault_root"
  cd "$vault_root"
else
  cd "$app_root"
fi

export ORION_VAULT_ROOT="$vault_root"
export ORION_APP_ROOT="$app_root"
export ORION_NODE_PATH="$node_path"
export PATH="$script_dir:$PATH"

printf '\nOrion Vault AI ready.\n'
printf 'Orion Vault e um app de notas local-first adaptado para IA e agentes.\n'
[ -z "$vault_root" ] || printf 'Vault ativo: %s\n' "$vault_root"
printf 'Helper: orion\n\nResumo rapido:\n'
if onboarding=$(orion /onboarding 2>/dev/null); then
  printf '%s\n' "$onboarding"
else
  printf '%s\n' '- orion /start' '- orion /guide' '- orion /skills' '- orion /context' '- orion /preview'
fi

if [ -n "$opencode_path" ]; then
  exec "$opencode_path" --prompt "$agent_prompt"
fi

if [ -n "$claude_code_path" ]; then
  exec "$claude_code_path" --append-system-prompt "$agent_prompt Inicialize o Orion Vault: execute orion /start e orion /skills. Depois aguarde o pedido do usuario."
fi

[ "${ORION_NO_INTERACTIVE_SHELL:-}" = '1' ] && exit 0
exec "${SHELL:-/bin/sh}" -i
