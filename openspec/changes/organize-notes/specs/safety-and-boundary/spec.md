# Spec: safety and boundary

## Regra de negócio
Toda operação de organização deve permanecer estritamente dentro do vault configurado e preservar dados existentes.

## Regras
1. Nenhum caminho resolvido pode escapar da raiz do vault.
2. Links simbólicos não podem ser usados para contornar a fronteira do vault.
3. O sistema não deve apagar conteúdo como parte da organização.
4. O sistema não deve sobrescrever arquivos existentes.
5. Em `dry-run`, nenhuma ação deve mutar o filesystem.
6. Qualquer violação de fronteira deve interromper a execução daquela intenção.

## Pontos de atenção
- A validação de fronteira precisa continuar acontecendo no caminho canônico, não apenas no texto recebido da IA.
- O comportamento com links simbólicos deve ser tratado como risco explícito e coberto por testes de integração.
- Se houver execução fora do modo de preview, ela deve continuar bloqueada por validação antes de qualquer escrita.

## Cenários

### Cenário 1: tentativa de escape por caminho relativo
Given uma ação com destino contendo tentativa de `..`
When o sistema resolve o caminho
Then a operação é rejeitada
And o vault permanece inalterado

### Cenário 2: link simbólico que sai do vault
Given um caminho que resolve para fora do vault por meio de link simbólico
When o sistema valida o caminho canônico
Then a operação é rejeitada
And nenhum arquivo é movido

### Cenário 3: preservação de dados no preview
Given uma operação de organização válida em `dry-run`
When o sistema gera o plano
Then o conteúdo original da nota deve ser preservado integralmente
And o filesystem permanece inalterado

### Cenário 4: preservação de dados na execução validada
Given uma operação de organização válida fora de `dry-run`
When o sistema executa as ações aprovadas
Then o conteúdo original das notas não deve ser sobrescrito silenciosamente
And qualquer conflito ou escape de fronteira bloqueia a ação correspondente
