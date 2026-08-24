# Tasks: suporte desktop Linux

## Bloco 1: ícone e release

- [ ] Copiar `Utils-Linux/IconOrion.png` para `build/icon.png`, sem conversão ou alteração visual.
- [ ] Confirmar que `package.json > build.linux.icon` aponta para `build/icon.png`.
- [ ] Executar `pnpm dist:linux`.
- [ ] Confirmar a presença de AppImage e `.deb` em `release/`.
- [ ] Registrar tamanho, checksum e versão dos dois artefatos de validação.

### Critério de saída

- `pnpm dist:linux` termina com código zero e ambos os artefatos Linux são gerados.

## Bloco 2: runtime de terminal Linux

- [ ] Criar `scripts/start-ai-terminal.sh` com o contrato de ambiente Orion.
- [ ] Criar `scripts/orion` como launcher executável da CLI compilada.
- [ ] Garantir LF e bit executável dos dois scripts.
- [ ] Incluir os scripts e recursos necessários fora do ASAR.
- [ ] Implementar seleção por plataforma no processo principal.
- [ ] Implementar seleção segura de emulador na ordem definida no design.
- [ ] Usar `PATH` com `:` no Linux e manter `Path` com `;` somente no Windows.
- [ ] Exibir erro acionável quando não houver terminal ou agente configurado.

### Critério de saída

- Em Ubuntu, Modo dev abre uma sessão no Vault ativo e `orion /start` funciona dentro dela.

## Bloco 3: OpenCode e Claude Code

- [ ] Confirmar que o fluxo OpenCode Linux herda `ORION_VAULT_ROOT`, `ORION_APP_ROOT`, `ORION_NODE_PATH` e `PATH` com `scripts/orion`.
- [ ] Confirmar que o fluxo Claude Code Linux herda o mesmo contrato.
- [ ] Confirmar que ausência de OpenCode ou Claude Code gera mensagem clara, sem falso sucesso.
- [ ] Confirmar que o MCP global `orion` continua disponível em uma sessão OpenCode aberta pelo launcher.

### Critério de saída

- Agentes instalados iniciam no Vault ativo e ferramentas Orion continuam acessíveis sem configuração de projeto.

## Bloco 4: paths e testes automatizados

- [ ] Normalizar separadores de caminhos antes da validação de boundary.
- [ ] Rejeitar componentes `..` e caminhos absolutos antes de acessar filesystem.
- [ ] Atualizar testes de boundary para `../escape` e `..\\escape`.
- [ ] Condicionar o teste PowerShell à plataforma Windows.
- [ ] Criar teste equivalente para o launcher Linux, condicionado à plataforma Linux.
- [ ] Cobrir a seleção de terminal e os erros de ausência de terminal.
- [ ] Executar `pnpm typecheck`, `pnpm lint` e `pnpm test` no Ubuntu.

### Critério de saída

- A suíte passa no Ubuntu e no Windows sem depender de executáveis de outra plataforma.

## Bloco 5: validação de distribuição

- [ ] Instalar o `.deb` em Ubuntu limpo ou VM limpa.
- [ ] Abrir a AppImage em Ubuntu limpo ou VM limpa.
- [ ] Validar criação, abertura, edição, busca e reinicialização de Vault.
- [ ] Validar Modo dev, OpenCode e Claude Code quando instalados.
- [ ] Validar sessão Wayland.
- [ ] Validar sessão X11 quando disponível.
- [ ] Registrar logs, versão Ubuntu, ambiente gráfico e terminal utilizado em caso de falha.

### Critério de saída

- Os artefatos instalados funcionam sem repositório fonte, `tsx` ou caminhos internos ao ASAR.

## Bloco 6: documentação

- [ ] Adicionar seção Ubuntu/Linux ao README conforme o design.
- [ ] Atualizar o runbook de validação desktop com passos Unix equivalentes aos PowerShell.
- [ ] Registrar limitações conhecidas e dependências opcionais de agentes.
- [ ] Revisar os comandos para não conter exemplos PowerShell na seção Linux.

### Critério de saída

- Um desenvolvedor Ubuntu consegue instalar, executar, empacotar e validar o Orion Vault usando somente a documentação.
