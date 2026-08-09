# Spec: project-foundation

## Regra de negócio
A fundação técnica do projeto deve existir como uma base consistente, tipada, modular e versionável, sem introduzir lógica de negócio implícita.

## Regras
1. O repositório deve conter uma estrutura compatível com Clean Architecture e SDD.
2. O projeto deve usar TypeScript como linguagem principal.
3. O projeto deve conter scripts de build, lint, testes e typecheck.
4. O projeto deve conter documentação OpenSpec mínima para governança de mudanças.
5. O registry OpenSpec deve refletir mudanças e módulos relevantes.
6. O domínio deve permanecer puro e independente.
7. A aplicação deve depender apenas do domínio.
8. A infraestrutura deve implementar portas e contratos sem violar fronteiras.

10. O projeto deve conter um comando E2E separado para validar o shell Electron contra um vault temporário.

## Cenários

### Cenário 1: base do projeto pronta para desenvolvimento
Given um repositório recém-inicializado
When a fundação é aplicada
Then a estrutura principal de camadas existe
And o projeto possui configuração de TypeScript
And o projeto possui scripts de validação e build
And o projeto possui documentação base para SDD e OpenSpec

### Cenário 2: registry reflete mudanças relevantes
Given uma nova change ou módulo relevante foi introduzido
When a documentação é atualizada
Then o `registry.md` deve refletir a adição

### Cenário 3: fronteiras arquiteturais preservadas
Given arquivos da camada de domínio e aplicação
When a base é implementada
Then o domínio não importa infra
And a aplicação não importa interfaces ou frameworks

### Cenário 4: tooling disponível
Given o projeto configurado
When um desenvolvedor executa scripts padrão
Then deve ser possível rodar build, lint, testes e typecheck de forma previsível

### Cenário 5: validação E2E do desktop
Given uma máquina com Electron disponível
When um desenvolvedor executa `pnpm test:e2e`
Then o projeto gera o build desktop necessário
And valida abertura, escrita, autosave e ciclo de janela sem usar o vault pessoal do desenvolvedor

## Critérios de aceitação
- a fundação suporta evolução incremental
- a fundação não mistura responsabilidade entre camadas
- a fundação é compatível com OpenSpec
- a fundação é adequada para implementação assistida por IA
