# Spec: desktop shell

## Regra de negócio
O sistema deve fornecer uma aplicação desktop local-first em TypeScript para operar o vault e suas notas sem depender de internet para o fluxo principal.

O shell desktop deve reaproveitar o core local existente e expor a mesma fronteira segura do vault, sem duplicar regras de negócio.

## Regras
1. A aplicação deve ser instalável como app desktop.
2. A aplicação deve funcionar com armazenamento local no dispositivo do usuário.
3. A aplicação deve permitir criar, abrir e validar um vault local.
4. A aplicação deve expor os fluxos de workspace, leitura e organização numa janela desktop.
5. A aplicação não deve exigir banco externo para o MVP.
6. A aplicação não deve exigir internet para criar, abrir, editar ou organizar notas localmente.
7. A aplicação deve preservar a fronteira segura do vault em todas as operações de escrita.
8. O shell desktop deve operar como camada de interface e orquestração sobre a base local existente.
9. O shell desktop deve lembrar o último vault ativo em armazenamento local e reabrir o workspace quando a raiz ainda for válida.
10. A lateral do desktop deve usar ícones minimalistas e mais refinados, sem poluição visual.
11. A tela inicial deve exibir cartões de métricas do vault, resumos de notas e um card rotativo de novidades do projeto.
12. Os modais internos devem ter aparência consistente com o desktop, com melhor alinhamento e foco visual.

## Pontos de atenção
- O shell desktop deve reaproveitar a lógica atual em vez de reimplementar as regras de negócio.
- A interface deve continuar simples e focada em leitura, organização e ação local.
- A persistência do estado do app deve ser local e mínima.
- Se houver integração com CLI, ela deve ser local e opcional, não uma dependência de rede.
- O runtime do shell deve ser escolhido sem quebrar a portabilidade da base TypeScript.
- Se o vault lembrado não existir mais, a aplicação deve voltar ao setup.
- A criação e abertura de vault devem usar o campo de caminho da interface como entrada principal.
- A interface desktop deve usar diálogos internos para ações como criar, renomear, mover e informar conteúdo inicial.
- O layout desktop deve privilegiar o encaixe da janela, com espaçamento consistente e leitura confortável.

## Cenários

### Cenário 1: app abre localmente
Given a aplicação desktop instalada
When o usuário inicia o app
Then a janela desktop é exibida
And o app opera sem internet obrigatória

### Cenário 2: vault local é criado
Given nenhum vault ativo
When o usuário informa um caminho local válido
Then o sistema cria ou abre o vault
And grava o estado localmente
And exibe o workspace
And o fluxo principal não depende de prompt modal do navegador

### Cenário 2b: vault lembrado é restaurado
Given um vault foi aberto anteriormente
When a aplicação desktop inicia novamente
Then o sistema restaura o último vault ativo localmente
And abre o workspace se a raiz ainda for válida
And volta ao setup se a raiz não existir mais

### Cenário 5: setup exibe métricas e novidades
Given a aplicação está na tela inicial
When o vault está disponível para leitura
Then a interface exibe cartões de métricas do vault
And mostra um card rotativo com novidades do projeto

### Cenário 3: notas são salvas no dispositivo
Given um vault ativo
When o usuário cria ou edita uma nota
Then o conteúdo é salvo no filesystem local
And o usuário não depende de armazenamento remoto

### Cenário 4: fronteira do vault é preservada
Given uma operação de escrita no desktop
When o usuário tenta sair da raiz do vault
Then a operação é rejeitada
And nenhum arquivo fora do vault é alterado
