# Comandos da Aplicação

## Propósito
Este arquivo define os comandos oficiais necessarios para instalar, validar, executar e operar a aplicacao `Orion Vault`.

Ele deve ser usado como referência canônica para a IA e para o processo de mudança, garantindo que todos os comandos exigidos para rodar a aplicação estejam documentados de forma explícita e versionável.

## Regras
1. A lista deve conter somente comandos necessários para operar a aplicação.
2. Cada comando deve ter finalidade clara.
3. Os comandos devem ser executáveis no ambiente do projeto sem ambiguidade.
4. Se o projeto mudar de stack, este arquivo deve ser atualizado junto com a change correspondente.
5. A IA deve registrar aqui os comandos reais usados para instalar, testar e executar a aplicação.

## Comandos obrigatórios

### Instalação de dependências
Comando responsável por preparar o ambiente local com todas as dependências do projeto.

```bash
pnpm install
```

### Execução da aplicação
Comando responsável por iniciar a aplicação em modo normal.

```bash
pnpm dev
```

### Criação de pasta
Comando responsável por criar pastas dentro do vault local.

```bash
pnpm dev mkdir --vault <path> --path <folder>
```

### Criação de arquivo Markdown
Comando responsável por criar notas Markdown dentro do vault local.

```bash
pnpm dev touch --vault <path> --path <file.md> --content <text>
```

### Edição de nota
Comando responsável por substituir o conteúdo de uma nota Markdown existente.

```bash
pnpm dev edit --vault <path> --path <file.md> --content <text>
```

### Renomear caminho
Comando responsável por renomear arquivos ou pastas dentro do vault.

```bash
pnpm dev rename --vault <path> --source <path> --destination <path>
```

### Mover caminho
Comando responsável por mover arquivos ou pastas entre locais do vault.

```bash
pnpm dev move --vault <path> --source <path> --destination <path>
```

### Execução do comando `organize`
Comando responsável por acionar a feature de organização automática de notas.

```bash
pnpm dev organize --vault <path>
```

Esse comando deve priorizar preview e relatório. Em `--dry-run`, não há mutação do filesystem; fora dele, a execução continua dependente das validações de segurança do vault.

### Execução do comando `validate`
Comando responsável por verificar a integridade estrutural do vault local.

```bash
pnpm dev validate --vault <path>
```

### Execução em dry-run
Comando responsável por simular a organização sem alterar arquivos.

```bash
pnpm dev organize --vault <path> --dry-run
```

Este é o modo principal esperado para validar o plano antes de qualquer execução real.

### Validação / testes
Comando responsável por verificar a integridade da aplicação antes de publicar ou aplicar mudanças.

```bash
pnpm test
pnpm typecheck
pnpm lint
```

### Build / compilação
Comando responsável por gerar a versão compilada da aplicação, quando aplicável.

```bash
pnpm build
```

## Critério de atualização
Este arquivo deve ser revisado sempre que houver alteração em:
- gerenciador de pacotes
- runtime principal
- scripts de execução
- pipeline de build
- flags obrigatórias do comando `organize`

## Observação
Todos os comandos acima operam localmente e não exigem serviços externos para validação.
