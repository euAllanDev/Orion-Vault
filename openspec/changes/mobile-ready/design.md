# Design: Mobile-Ready Note Identity

## Context

O Orion Vault é um workspace local-first baseado em arquivos Markdown.

O filesystem continua sendo a fonte de verdade para o conteúdo das notas.

O Desktop conhece uma raiz física do Vault (`VaultRoot`) e resolve arquivos a partir
dessa raiz.

Para permitir que a mesma nota seja reconhecida em diferentes dispositivos, precisamos
de uma identidade independente do sistema operacional.

A identidade escolhida é o caminho relativo ao Vault.

## Core Model

A representação lógica deve seguir:

    NoteIdentity
      relativePath

O filesystem deve seguir:

    VaultRoot
      +
    relativePath
      =
    resolvedPath

Exemplo:

    relativePath = "Projetos/Orion.md"

    Linux:
    /home/user/Orion/vault/Projetos/Orion.md

    Windows:
    C:\Users\User\Orion\vault\Projetos\Orion.md

A identidade continua sendo:

    Projetos/Orion.md

## Separation of Concerns

### Logical Identity

`relativePath` identifica uma nota dentro de um Vault.

Ele deve:

- ser relativo à raiz do Vault;
- não conter drive letter;
- não conter `/home/...`;
- não conter `C:\...`;
- não depender do usuário atual;
- usar uma representação normalizada consistente.

### Physical Resolution

`VaultRoot` continua sendo responsável pela localização física.

A resolução deve ser equivalente conceitualmente a:

    resolve(VaultRoot, relativePath)

Essa resolução deve permanecer encapsulada na camada responsável pelo filesystem.

O restante do domínio não deve precisar conhecer o caminho absoluto da máquina.

## Path Normalization

O sistema deve tratar `relativePath` como um caminho lógico.

A representação persistida deve usar separadores `/`, independentemente do sistema
operacional.

Exemplo:

    Projetos/Orion.md

e não:

    Projetos\Orion.md

No Windows, o filesystem pode converter a representação lógica para o formato necessário
ao acessar o sistema operacional.

## Safety

Um `relativePath` nunca deve permitir escapar do VaultRoot.

Entradas equivalentes a:

    ../secret.md

ou:

    ../../secret.md

não devem ser aceitas como identidade válida.

A resolução física deve garantir que o arquivo permaneça dentro do Vault.

Essa proteção é especialmente importante porque o `relativePath` será futuramente
uma informação que poderá atravessar fronteiras entre dispositivos.

## Existing Vaults

Vaults existentes não devem precisar ser reorganizados.

Um Vault como:

    vault/
      Financas/
        orcamento.md
      Projetos/
        Orion.md

continua exatamente igual.

A mudança está na representação da identidade, não na estrutura física do Vault.

## Compatibility Layer

Durante a transição, componentes que ainda trabalham com caminhos absolutos podem
continuar fazendo isso nas fronteiras necessárias.

A conversão deve ocorrer de forma explícita:

    physical path
        ↓
    VaultRoot-relative path
        ↓
    logical identity

e:

    logical identity
        ↓
    VaultRoot
        ↓
    physical path

Não devemos realizar uma grande refatoração de uma vez.

## Metadata

Metadados de arquivo que forem necessários para futuras operações devem poder carregar:

    relativePath
    mtime

`mtime` representa o momento de modificação observado no filesystem.

Ele não deve ser tratado como identidade da nota.

O `relativePath` identifica o arquivo.

O `mtime` descreve o estado observado daquele arquivo.

## Why mtime Now

O `mtime` não implementará sincronização nesta mudança.

Ele existe para evitar que uma futura implementação de sync precise alterar novamente
as estruturas fundamentais de representação de notas.

Uma futura OpenSpec poderá utilizar:

    relativePath
    mtime
    content hash

para detectar alterações.

Hash e sincronização ficam fora desta mudança.

## MCP

Os contratos MCP existentes devem permanecer estáveis.

Não devemos expor `VaultRoot` ou caminhos absolutos através de schemas públicos.

Quando uma ferramenta MCP precisar acessar uma nota, a resolução física continua sendo
responsabilidade do runtime.

A identidade lógica pode ser utilizada internamente sem alterar o contrato público
das tools.

## Search and Retrieval

Não haverá mudança proposital em:

- ranking;
- chunking;
- embeddings;
- retrieval;
- snippets;
- budgets.

Os índices podem continuar utilizando seus identificadores existentes durante a
migração, desde que não introduzam dependência adicional de caminhos absolutos.

Se alguma estrutura persistida precisar de adaptação, a mudança deve ser compatível
com índices existentes.

## Indexes

A introdução de `relativePath` não deve exigir que o usuário apague ou regenere
manualmente o índice.

Quando uma estrutura de índice precisar ser atualizada, a implementação deve:

1. detectar a estrutura existente;
2. preservar dados recuperáveis;
3. migrar ou reconstruir de maneira segura;
4. continuar funcionando com o Vault.

Não devemos introduzir uma migração destrutiva apenas para alterar a identidade.

## MCP Runtime

O runtime compartilhado introduzido anteriormente continua sendo utilizado.

Esta mudança não deve recriar runtimes nem alterar o ciclo de vida do MCP.

O objetivo é apenas melhorar a identidade interna dos recursos.

## Mobile

O Mobile não faz parte desta implementação.

O design apenas garante que o core possa futuramente receber:

    relativePath

sem precisar conhecer:

    Windows
    Linux
    macOS
    Android
    iOS

A implementação Mobile será responsável por sua própria persistência local.

## Testing Strategy

Os testes devem cobrir:

### Relative Identity

- caminho simples;
- diretórios aninhados;
- notas na raiz;
- normalização de separadores;
- rejeição de caminhos absolutos;
- rejeição de traversal.

### Platform Resolution

- Linux;
- Windows;
- resolução relativa → física;
- física → relativa.

### Existing Behavior

- leitura;
- escrita;
- busca;
- indexação;
- contexto;
- MCP;
- CLI.

### Compatibility

Um Vault existente deve continuar produzindo os mesmos resultados funcionais.

## Rollout

A implementação deve ocorrer em pequenos passos:

1. introduzir abstração/normalização;
2. adicionar testes;
3. adaptar os pontos internos necessários;
4. preservar compatibilidade;
5. validar Desktop;
6. validar MCP;
7. somente depois considerar consumidores Mobile.

## Explicit Constraint

Nenhuma alteração deve ser aceita apenas porque torna a arquitetura "mais bonita".

Cada mudança estrutural deve ter uma necessidade concreta relacionada à identidade
portátil das notas.

O objetivo é preparar o core, não reescrevê-lo.