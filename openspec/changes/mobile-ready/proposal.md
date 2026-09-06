# Proposal: Mobile-Ready Note Identity

## Why

O Orion Vault atualmente trabalha com arquivos Markdown dentro de um Vault local.
Em diferentes partes do sistema, a localização física do arquivo pode aparecer como um
caminho absoluto dependente do sistema operacional.

Isso funciona bem para o Desktop, mas cria uma limitação para uma futura experiência
Mobile e, principalmente, para sincronização entre dispositivos.

Um arquivo como:

/home/allan-dev/Downloads/Orion-Vault/vault/Financas/orcamento.md

não possui a mesma identidade quando o mesmo Vault é aberto em:

C:\Users\Allan\Orion-Vault\vault\Financas\orcamento.md

A identidade lógica da nota, porém, é a mesma:

Financas/orcamento.md

Precisamos separar a identidade lógica da nota da sua localização física no
filesystem.

## Goal

Preparar o core do Orion para tratar `relativePath` como identidade lógica de uma
nota dentro do Vault, mantendo o `VaultRoot` como mecanismo para resolver essa
identidade para um arquivo físico.

A mudança também deve introduzir `mtime` nos metadados relevantes quando isso for
necessário para futuras operações de sincronização.

Esta mudança NÃO implementa sincronização entre dispositivos.

## Non-goals

Esta mudança não deve:

- criar o aplicativo Mobile;
- implementar sincronização;
- implementar conflitos de sincronização;
- criar backend de sincronização;
- alterar o protocolo MCP sem necessidade;
- alterar os schemas públicos das ferramentas MCP sem necessidade;
- substituir o filesystem do Desktop;
- remover `VaultRoot`;
- refatorar todo o domínio de notas;
- alterar o algoritmo de busca;
- alterar chunking ou retrieval;
- alterar embeddings;
- alterar o comportamento do Agent Orion;
- migrar manualmente Vaults existentes;
- exigir alteração na estrutura dos Vaults dos usuários.

## Compatibility Requirement

O Desktop atual deve continuar funcionando sem alteração perceptível.

Todos os fluxos existentes devem permanecer funcionais, incluindo:

- criação de notas;
- leitura;
- edição;
- busca;
- indexação;
- relações;
- contexto;
- CLI;
- Web;
- MCP;
- `orion_read`;
- `orion_search`;
- `orion_context`;
- `orion_remember`.

A implementação deve ser incremental e compatível com o estado atual do projeto.

## Proposed Change

Introduzir uma distinção explícita entre:

- identidade lógica: `relativePath`;
- raiz física do Vault: `VaultRoot`;
- caminho físico resolvido: `VaultRoot + relativePath`.

Exemplo:

    relativePath:
    Financas/orcamento.md

    VaultRoot:
    /home/allan-dev/Orion-Vault/vault

    resolvedPath:
    /home/allan-dev/Orion-Vault/vault/Financas/orcamento.md

O caminho físico continua sendo usado pelo filesystem.

O `relativePath` passa a representar a identidade portátil da nota.

## Migration Strategy

A mudança deve evitar uma migração destrutiva.

Sempre que possível, APIs internas devem passar a trabalhar com a identidade relativa
sem exigir que todas as camadas sejam modificadas simultaneamente.

O Desktop pode continuar recebendo ou produzindo caminhos físicos nas fronteiras
necessárias, desde que a identidade da nota seja normalizada para um caminho relativo
quando entrar no domínio.

## Success Criteria

A mudança será considerada concluída quando:

1. notas puderem ser identificadas por `relativePath`;
2. `VaultRoot` continuar resolvendo arquivos físicos normalmente;
3. o Desktop continuar funcionando;
4. Vaults existentes continuarem funcionando;
5. MCP continuar funcionando;
6. testes existentes permanecerem verdes;
7. novos testes cobrirem a identidade relativa;
8. caminhos Windows e Linux forem tratados corretamente;
9. `mtime` estiver disponível nos metadados definidos pela mudança;
10. nenhuma funcionalidade de sincronização for introduzida prematuramente.

## Future Direction

Esta mudança cria a fundação para:

    Desktop Vault
          |
          v
    relativePath
          |
          +---- Mobile Vault
          |
          +---- Sync Engine
          |
          +---- Conflict Resolution

A sincronização será tratada em uma OpenSpec separada.