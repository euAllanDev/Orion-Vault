# Suporte completo ao desktop Linux

## Objetivo

Permitir desenvolver, executar, testar, empacotar e instalar o Orion Vault em Ubuntu Linux x64 com o mesmo fluxo principal disponível no desktop Windows: app Electron, Vault local, Modo dev e abertura de agentes a partir do Vault ativo.

## Problema atual

- `pnpm typecheck`, `pnpm lint` e `pnpm build` passam no Ubuntu, mas `pnpm test` falha em testes orientados a Windows.
- O Modo dev depende de `powershell.exe`, `wt.exe`, `where.exe`, `Path` com `;`, scripts `.ps1` e launchers `.cmd`.
- `pnpm dist:linux` não gera AppImage ou `.deb`: `package.json` aponta para `build/icon.png`, mas o arquivo não existe.
- A imagem pronta para Linux está em `Utils-Linux/IconOrion.png`; ela é um PNG RGB válido, quadrado, de 1254x1254 pixels.
- A documentação só declara Node.js e pnpm, sem instruções ou limites operacionais para Ubuntu.

## Escopo

- Corrigir o empacotamento Linux para AppImage e `.deb`.
- Adicionar um launcher Unix para o Modo dev e para OpenCode/Claude Code, preservando o Vault ativo e as variáveis de ambiente do Orion.
- Tornar os testes de caminho e terminal determinísticos em Windows e Linux.
- Documentar instalação, desenvolvimento, validação e limitações no Ubuntu.

## Fora de escopo

- Alterar as tools MCP existentes ou criar novas tools MCP.
- Criar Agent Orion para OpenCode.
- Alterar o comportamento de escrita, permissões ou limites de segurança do Vault.
- Suportar distribuições Linux além de Ubuntu x64 nesta mudança.
- Trocar Electron, Node, pnpm ou o sistema de build.

## Resultado esperado

Em um Ubuntu desktop suportado, um usuário deve conseguir instalar a release `.deb` ou executar a AppImage, abrir um Vault, acionar Modo dev, iniciar OpenCode ou Claude Code no Vault ativo e executar `orion /start` sem depender de PowerShell, Windows Terminal ou caminhos Windows.
