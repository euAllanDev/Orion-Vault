# Design: suporte desktop Linux

## Plataforma alvo

- Ubuntu LTS x64 com sessão gráfica Wayland ou X11.
- Node.js 20 ou superior para desenvolvimento; a versão recomendada deve continuar alinhada ao `packageManager` do projeto.
- pnpm 9.12.0 para desenvolvimento.
- Build local para os formatos `AppImage` e `deb` já declarados em `package.json`.

## Empacotamento e branding

### Ícone Linux

O único artefato de imagem necessário para esta mudança já existe e não deve ser convertido:

```text
origem:  Utils-Linux/IconOrion.png
destino: build/icon.png
```

O arquivo de origem é um PNG RGB válido de 1254x1254 pixels, aceito pelo `electron-builder`. A implementação deve copiar esse mesmo arquivo para `build/icon.png` e manter `package.json > build.linux.icon` apontando para esse destino. Não usar o `.ico` como ícone Linux e não criar uma nova logo.

### Artefatos obrigatórios

`pnpm dist:linux` deve concluir com código zero e produzir:

- `release/Orion Vault-<versão>.AppImage`
- `release/Orion Vault-<versão>.deb`

Os dois artefatos devem usar o nome, appId, categoria e ícone definidos pelo projeto. O diretório `release/` é saída gerada e não entra no controle de versão.

## Launcher de terminal no Linux

### Contrato comum

O launcher Linux deve preservar o contrato já exposto pelo fluxo Windows:

- iniciar no diretório do Vault ativo;
- exportar `ORION_VAULT_ROOT` com a raiz absoluta do Vault;
- exportar `ORION_APP_ROOT` com a raiz física do runtime Orion;
- exportar `ORION_NODE_PATH` com o Node utilizado pelo runtime;
- disponibilizar o comando `orion` para a sessão e seus subprocessos;
- apresentar o onboarding atual, incluindo `orion /start`, sem depender de arquivos internos do ASAR;
- aceitar os caminhos de OpenCode e Claude Code quando essas integrações forem acionadas;
- preservar argumentos, stdin e código de saída da CLI do Orion.

O launcher não deve conceder permissões adicionais ao agente. `ORION_VAULT_ROOT` limita apenas os comandos do Orion e não é sandbox para comandos nativos do terminal ou do agente.

### Arquivos Unix

Adicionar dois recursos físicos para Unix, ambos incluídos fora do ASAR quando a aplicação for empacotada:

- `scripts/start-ai-terminal.sh`: bootstrap da sessão Linux;
- `scripts/orion`: executável Unix que encaminha argumentos para a CLI compilada do Orion.

Os dois arquivos devem usar LF, possuir bit executável na árvore Git e evitar sintaxe específica de Bash quando POSIX shell for suficiente. O launcher pode usar `bash` explicitamente quando for necessário para inicialização interativa, desde que o requisito esteja documentado para Ubuntu.

O executável `orion` deve chamar `dist/cli/main.mjs` pela variável `ORION_NODE_PATH` quando disponível, com fallback para `node` presente no `PATH`. Ele não deve depender de `tsx`, fontes TypeScript ou caminhos virtuais dentro de `app.asar` na release instalada.

### Escolha do emulador

O processo principal deve selecionar comportamento por `process.platform`:

- `win32`: preservar o caminho PowerShell e Windows Terminal existente;
- `linux`: usar um launcher Unix e um emulador de terminal disponível;
- outras plataformas: manter o comportamento atual ou informar indisponibilidade claramente, sem simular suporte.

No Linux, a seleção deve tentar nesta ordem:

1. o executável definido em `TERMINAL`, se existir e for executável;
2. `x-terminal-emulator`;
3. `gnome-terminal`;
4. `konsole`;
5. `xfce4-terminal`.

Cada candidato deve receber argumentos próprios e seguros para abrir uma sessão no Vault e executar `scripts/start-ai-terminal.sh`. Não construir um comando com interpolação de valores não confiáveis em uma string de shell. Usar `spawn` com lista de argumentos e `env` explícito.

Se nenhum emulador estiver disponível, o handler IPC deve retornar erro acionável para a interface, explicando que é preciso instalar ou configurar um terminal compatível. Ele não deve sinalizar abertura bem-sucedida quando o processo filho falhar.

### Ambiente Unix

No Linux, acrescentar o diretório de scripts ao `PATH` usando `:`. Não usar `Path` com `;`, que é específico de Windows. O ambiente herdado permanece preservado e apenas as variáveis do contrato Orion são acrescentadas ou substituídas.

O launcher deve executar o agente configurado somente após preparar esse ambiente. Se `opencode` ou `claude` não estiver no `PATH` ou não puder ser resolvido, a interface deve informar qual executável está ausente e como instalá-lo, sem encerrar silenciosamente o terminal.

## Paths e segurança entre plataformas

Toda entrada de caminho relativo que represente uma nota, pasta ou destino no Vault deve ser normalizada para o formato lógico interno antes da verificação de boundary:

- converter `\` em `/`;
- rejeitar caminho absoluto, componente vazio relevante e qualquer componente `..`;
- resolver o caminho somente depois da validação;
- confirmar que o caminho resolvido permanece abaixo do Vault raiz.

O objetivo é que `../escape` e `..\\escape` sejam ambos rejeitados em Windows e Linux. Aceitar `\` como caractere em nome de arquivo Linux não é desejado para o Vault porque torna o conteúdo incompatível entre plataformas.

## Testes

### Testes unitários e integração

- O teste PowerShell deve executar somente em Windows, com condição explícita baseada em `process.platform`.
- Adicionar teste Linux equivalente para o launcher `.sh`; ele deve verificar diretório inicial, `ORION_VAULT_ROOT`, disponibilidade do comando `orion` e onboarding.
- O teste Linux deve pular de forma explícita fora de Linux, não falhar por ausência de executáveis do sistema.
- Os testes de boundary devem cobrir `../escape` e `..\\escape` em todas as plataformas.
- Adicionar testes para a seleção do terminal: `TERMINAL`, fallback disponível e erro quando nenhum candidato existir.
- Testar que as variáveis exportadas por Windows e Linux possuem o mesmo contrato sem exigir que os launchers tenham a mesma implementação.

### Validação manual Ubuntu

Validar em uma sessão gráfica Ubuntu Wayland e, quando viável, X11:

1. executar `pnpm dev:desktop` após `pnpm build`;
2. abrir ou criar Vault e confirmar a árvore e edição de nota;
3. acionar Modo dev e confirmar abertura no Vault ativo;
4. executar `pwd`, `echo "$ORION_VAULT_ROOT"`, `orion /start` e `orion /search --query "Incident"`;
5. acionar a entrada OpenCode, confirmar que ela nasce no Vault ativo e que o MCP global Orion continua disponível;
6. repetir com Claude Code quando instalado;
7. instalar o `.deb`, repetir o fluxo sem depender do repositório fonte;
8. executar a AppImage e repetir o fluxo sem depender do repositório fonte.

## Documentação Ubuntu

O README deve ganhar uma seção Linux/Ubuntu com:

- requisitos: Node.js 20+, pnpm, sessão gráfica e um emulador de terminal suportado;
- comandos de desenvolvimento: `pnpm install`, `pnpm build`, `pnpm dev:desktop`, `pnpm dev:web` e `pnpm dev:mcp`;
- comando de release: `pnpm dist:linux`;
- localização dos artefatos em `release/`;
- como instalar o `.deb` e executar a AppImage;
- requisito de FUSE ou alternativa de extração quando a AppImage não abrir;
- limites claros: OpenCode e Claude Code continuam opcionais e precisam estar instalados pelo usuário;
- instrução para reportar distribuição, sessão gráfica, emulador de terminal e logs ao abrir um bug.

## Critérios de aceite

- `pnpm typecheck`, `pnpm lint` e `pnpm test` passam no Ubuntu alvo.
- `pnpm dist:linux` gera AppImage e `.deb` sem erro de ícone.
- A release instalada abre em Ubuntu suportado e mantém um Vault ativo funcional.
- Modo dev abre terminal Linux no Vault ativo e disponibiliza `orion` e as três variáveis Orion.
- Nenhum caminho Windows, `.ps1`, `powershell.exe`, `wt.exe` ou `where.exe` é executado no fluxo Linux.
- Tentativas `../escape` e `..\\escape` são rejeitadas no Linux e no Windows.
- A documentação permite que outra pessoa prepare e valide Ubuntu sem deduzir passos implícitos.
