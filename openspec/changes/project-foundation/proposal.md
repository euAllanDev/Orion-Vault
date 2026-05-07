# Change: project-foundation

Status: draft
Date: 2026-05-06

## Objetivo
Estabelecer a fundação técnica do projeto `Marika CLI Notes` com stack TypeScript, estrutura modular, tooling de qualidade e base documental compatível com OpenSpec e SDD.

## Problema
O projeto ainda não possui uma base executável consistente para desenvolvimento, validação, documentação e evolução assistida por IA. Sem essa fundação, a implementação de features fica frágil, acoplada e difícil de validar.

## Solução proposta
Criar a base do repositório com:
- configuração de TypeScript
- configuração de lint, format e build
- setup de testes
- estrutura inicial das camadas arquiteturais
- contratos e tipos base do domínio e da aplicação
- documentação arquitetural e SDD
- integração com OpenSpec por meio de constitution, registry, changes e specs

## Impacto no sistema
- reduz risco de divergência arquitetural
- acelera implementação de features futuras
- melhora rastreabilidade entre specs e código
- facilita validação automática por IA e humanos

## Escopo
Incluído:
- package manager e scripts principais
- configuração de TypeScript
- configuração de lint e formatação
- configuração de build e testes
- estrutura base de pastas e módulos
- documentação inicial da arquitetura
- registry OpenSpec atualizado

Excluído:
- implementação completa das features de organização
- regras específicas do domínio além das entidades base
- integração real com providers externos nesta fase

## Resultado esperado
Ao final da mudança, o repositório deve estar pronto para receber implementações incrementais com baixo acoplamento, alta coesão e rastreabilidade via OpenSpec.
