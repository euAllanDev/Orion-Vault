# Design

## Visão geral
O fluxo segue três etapas principais:
1. coletar contexto do vault
2. pedir à IA um plano de organização estruturado
3. validar e apresentar o plano primeiro em modo preview/dry-run

A IA atua como decisor. O sistema atua como observador, validador e relator confiável.

Na implementação atual, o fluxo opera local-first e pode rodar sem chamadas externas.

## Decisões arquiteturais

### Separação de responsabilidades
- `domain`: entidades, regras e invariantes
- `application`: casos de uso e orquestração do fluxo
- `infra`: leitura do filesystem, integração com IA e execução concreta de ações
- `interfaces/cli`: entrada do comando e exibição do resultado

### Contrato da IA
A IA não recebe permissão para executar nada. Ela apenas produz uma `AIResponse` estruturada contendo ações propostas e justificativas. A aplicação valida esquema, escopo e segurança antes de transformar isso em um plano de preview.

O provider é um adapter local substituível, para manter o fluxo executável sem depender de rede.
Na implementação atual, o provider local usa heurísticas determinísticas baseadas em título e nome do arquivo para gerar ações previsíveis.

### Modelo de execução
O sistema trabalha em dois estágios:
- `observe`: ler vault, estruturar contexto e extrair sinais relevantes
- `plan`: gerar e validar ações sugeridas

O comportamento principal continua sendo preview-first: `dry-run` termina em relatório sem mutação, enquanto a execução real só pode acontecer fora desse modo e após validação de segurança.

## Regras de segurança
- a IA nunca acessa o filesystem diretamente
- toda intenção deve permanecer dentro do vault
- links simbólicos não devem permitir escape do vault
- qualquer caminho resolvido deve ser validado por resolução canônica
- respostas inválidas ou ambíguas são rejeitadas antes de virar plano
- se uma etapa falhar, a execução deve parar e reportar o estado parcial com clareza

## Regras de domínio
- uma `Note` representa um arquivo Markdown dentro do vault
- um `Vault` define a fronteira de operação segura
- uma `Action` representa uma intenção atômica proposta pela IA
- uma `AIResponse` contém somente ações permitidas e metadados de justificativa
- um `Command` representa a intenção do usuário na CLI, incluindo flags como `--dry-run`

## Estratégia de organização
O comando pode sugerir estrutura de pastas com base em:
- título da nota
- tags ou frontmatter
- palavras-chave recorrentes
- agrupamentos temáticos
- relacionamentos entre notas

A regra de negócio não depende de um único critério. A sugestão de estrutura deve ser derivada de evidências observáveis no conteúdo.

## Resolução de conflitos
Se o destino já existir, a intenção correspondente deve ser marcada como conflito no relatório. O sistema não deve tentar mesclar, sobrescrever ou truncar conteúdo automaticamente.

## Idempotência
Executar `organize --dry-run` repetidamente sobre um vault já observado não deve produzir mudanças no filesystem. Fora de `dry-run`, o plano e a execução devem evitar alterações desnecessárias quando o estado já estiver alinhado.

## Alternativas consideradas

### IA executando diretamente
Rejeitada por violar o modelo de segurança e eliminar controle sobre efeitos colaterais.

### Mover arquivos com heurísticas locais apenas
Rejeitada como solução inicial porque reduz a qualidade da organização sem o contexto semântico da IA.

### Permitir sobrescrita automática
Rejeitada para evitar perda de dados.

### Edição inline de conteúdo antes de mover
Adiada. A feature atual trata organização estrutural, não reescrita semântica de conteúdo.

### Roots semânticos
Adiado para um passo futuro. A ideia é gerar agrupamentos de notas semelhantes como preview visual e contexto para IA, sem alterar o filesystem. Isso deve ser integrado depois ao dashboard e ao fluxo de descoberta.
