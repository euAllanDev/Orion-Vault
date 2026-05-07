# Spec: AI response contract

## Regra de negócio
A IA deve retornar uma resposta estruturada compatível com o contrato da aplicação, contendo apenas intenções permitidas para a feature de observação e planejamento do vault.

## Regras
1. A resposta deve ser estruturada e parseável.
2. A resposta só pode conter ações de organização autorizadas pela aplicação.
3. Cada ação deve declarar origem, destino e tipo de operação quando aplicável.
4. A resposta deve ser tratada como sugestão, nunca como comando executável direto.
5. A aplicação deve rejeitar ações ambíguas, incompletas ou incompatíveis com o schema.
6. No MVP, a resposta alimenta o plano e o relatório, não uma mutação automática.

## Pontos de atenção
- O contrato hoje depende de um conjunto pequeno de tipos de ação; qualquer expansão precisa ser versionada com cuidado.
- Campos opcionais não devem virar dependência implícita para execução ou relatório.
- A resposta da IA precisa continuar sendo validada antes de chegar ao executor, mesmo quando o provider for local.

## Cenários

### Cenário 1: resposta estruturada válida
Given a IA retorna uma lista de ações em formato válido
When a aplicação valida o conteúdo
Then a resposta é aceita como plano candidato
And segue para validação de segurança e execução

### Cenário 2: resposta com tipo de ação não permitido
Given a IA retorna uma ação fora do conjunto permitido
When a aplicação valida a resposta
Then a ação é rejeitada
And ela não entra no plano executável

### Cenário 3: resposta incompleta
Given a IA retorna uma ação sem origem ou destino
When a aplicação valida a resposta
Then a ação é rejeitada por insuficiência de dados
And o sistema não executa mutação parcial
