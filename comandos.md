# Comandos da Aplicação

Este arquivo acompanha a aplicação e serve como guia rápido para humanos e IA.

## Instalação
```bash
pnpm install
```

## Execução
```bash
pnpm dev
pnpm dev:desktop
```

## Observação e planejamento
```bash
pnpm dev /context --vault <path>
pnpm dev /search --vault <path> --query <texto>
pnpm dev /plan --vault <path>
pnpm dev /preview --vault <path>
pnpm dev /apply --vault <path>
```

## Workspace
```bash
pnpm dev mkdir --vault <path> --path <folder>
pnpm dev touch --vault <path> --path <file.md> --content <text>
pnpm dev edit --vault <path> --path <file.md> --content <text>
pnpm dev rename --vault <path> --source <path> --destination <path>
pnpm dev move --vault <path> --source <path> --destination <path>
```

## Validação
```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Dica para IA
Se você precisar descobrir os comandos da aplicação, procure por `comandos.md` no diretório do app.
