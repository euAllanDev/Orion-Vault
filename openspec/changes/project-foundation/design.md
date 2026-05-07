# Design

## Visão geral
A fundação técnica estabelece a base operacional do projeto sem introduzir comportamento funcional de negócio além dos contratos mínimos necessários para suportar o domínio.

## Decisões arquiteturais

### Stack
- TypeScript para tipagem forte e modularidade
- Node.js como runtime
- pnpm como package manager
- Vitest para testes
- tsup para build
- ESLint e Prettier para qualidade de código
- Zod para validação de contratos estruturados

### Organização por camadas
O repositório segue a arquitetura definida previamente:
- `domain` puro
- `application` para orquestração e contratos de caso de uso
- `infra` para implementações técnicas
- `interfaces` para entrada e saída
- `openspec` para governança de mudança
- `docs` para diretrizes e arquitetura

### Base documental
A fundação inclui documentação mínima e rastreável para sustentar SDD:
- constitution
- registry
- guidelines
- architecture overview

### Estratégia de implementação
Primeiro são criados contratos, tipos e estruturas. Depois, as implementações concretas serão adicionadas apenas quando a spec de cada comportamento estiver disponível.

## Regras de segurança arquitetural
- domain não pode importar infra ou interfaces
- application não pode depender de frameworks
- infra implementa portas, não regras de negócio
- interfaces não contêm lógica de domínio

## Alternativas consideradas

### Monorepo com múltiplos pacotes
Adiado. A base atual pode crescer para isso, mas a complexidade inicial não é necessária.

### JavaScript sem tipagem
Rejeitado por reduzir segurança, legibilidade e controle de contrato.

### Setup mínimo sem lint e testes
Rejeitado por não atender ao objetivo de base profissional e verificável.
