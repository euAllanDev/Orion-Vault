# Spec: organize command

## Regra de negócio
O comando `organize` deve analisar notas Markdown dentro de um vault, gerar uma proposta de organização baseada em contexto semântico e priorizar um fluxo preview-first, com execução real permitida apenas após validação e fora do modo `dry-run`.

## Regras
1. O comando só opera sobre arquivos Markdown localizados dentro do vault configurado.
2. A IA só pode sugerir ações; ela não executa nenhuma mutação.
3. Toda ação proposta deve ser validada antes de virar parte do plano.
4. O sistema não pode sobrescrever arquivos existentes.
5. O sistema não pode mover arquivos para fora do vault.
6. O comando deve suportar `dry-run` e não alterar o filesystem nesse modo.
7. O resultado deve ser determinístico para o mesmo estado de entrada, salvo variações do modelo de IA.
8. O fluxo de desenvolvimento e validação deve continuar executável localmente.
9. O comando deve priorizar observação, contexto e planejamento, não edição.
10. Erros de configuração, leitura ou validação devem ser convertidos em mensagens controladas, sem stack trace bruto para o usuário.
11. Fora do modo `dry-run`, o sistema pode executar apenas ações já validadas e bloqueadas por conflito, fronteira e regras de segurança.

## Cenários

### Cenário 1: organizar notas do vault com sucesso
Given um vault com múltiplos arquivos Markdown e contexto suficiente para agrupamento
When o usuário executa `organize`
Then o sistema coleta o contexto do vault
And envia esse contexto para a IA
And recebe uma lista estruturada de ações
And valida cada ação
And retorna um resumo do plano e dos possíveis impactos

### Cenário 1b: preview sem mutação em dry-run
Given um vault com múltiplos arquivos Markdown e contexto suficiente para agrupamento
When o usuário executa `organize --dry-run`
Then o sistema não altera o filesystem
And retorna um relatório de preview
And mantém o vault inalterado

### Cenário 2: modo dry-run não altera arquivos
Given um vault com notas elegíveis para reorganização
When o usuário executa `organize --dry-run`
Then o sistema calcula o plano de organização
And mostra as ações propostas
And não move, cria, renomeia ou altera nenhum arquivo
And retorna um relatório sem mutação

### Cenário 2b: execução validada aplica ações permitidas
Given um vault com notas elegíveis para reorganização
When o usuário executa `organize` fora do modo `dry-run`
Then o sistema calcula o plano de organização
And valida cada ação contra fronteira, conflitos e regras de segurança
And executa apenas as ações permitidas
And retorna um resumo com ações executadas e ações bloqueadas

### Cenário 3: ação fora do vault é rejeitada
Given uma resposta da IA contendo um destino fora da raiz do vault
When o sistema valida a ação
Then a ação é rejeitada
And a execução é interrompida ou marcada como bloqueada conforme política de falha
And nenhum arquivo é movido para o destino inválido

### Cenário 4: conflito de destino impede sobrescrita
Given uma ação válida cujo destino já existe
When o sistema valida a operação
Then a ação é rejeitada por conflito
And o arquivo original permanece no local de origem
And nenhum conteúdo é sobrescrito

### Cenário 5: resposta malformada da IA é rejeitada
Given uma resposta da IA sem schema válido ou com campos obrigatórios ausentes
When o sistema tenta interpretar a resposta
Then a resposta é rejeitada
And nenhuma ação é executada
And o usuário recebe um erro de validação estruturada

### Cenário 6: vault sem notas Markdown não gera mutação
Given um vault sem arquivos Markdown elegíveis
When o usuário executa `organize`
Then o sistema retorna que não há ações a executar
And não altera o filesystem

### Cenário 7: organização repetida é idempotente
Given um vault já organizado conforme a regra atual
When o usuário executa `organize` novamente
Then o sistema pode gerar um plano vazio ou sem mudanças relevantes
And não realiza alterações desnecessárias

### Cenário 8: erro de configuração é tratado
Given uma configuração inválida ou ausente
When o usuário executa qualquer comando de observação ou planejamento
Then o sistema exibe uma mensagem controlada
And não mostra stack trace bruto
And encerra com falha previsível

## Critérios de aceitação
- nenhuma ação executada sem validação
- nenhuma operação fora do vault
- `dry-run` não altera o estado local
- execução fora de `dry-run` continua sujeita às mesmas validações de segurança
- conflitos não causam sobrescrita
- respostas inválidas da IA não avançam para execução
- falhas operacionais viram mensagens controladas

## Pontos de atenção
- O relatório final ainda precisa cobrir conflitos, no-ops e bloqueios de forma auditável.
- A saída da IA deve continuar compatível com o schema validado pela aplicação; qualquer novo tipo de ação exige atualização coordenada da spec e do validador.

## Refinamento futuro
- enriquecer relatórios com códigos de erro mais específicos
- incluir hints de recuperação para falhas comuns
- padronizar mensagens por comando e por tipo de falha
