# Spec: vault setup

## Regra de negócio
O sistema deve iniciar a interface a partir de um vault padrão local, tornando essa raiz a referência ativa e abrindo-a automaticamente ao carregar o app.

## Regras
1. O sistema deve abrir automaticamente o vault padrão do app ao iniciar.
2. A raiz padrão deve ser validada antes de virar o vault ativo.
3. O sistema deve rejeitar caminhos fora da fronteira permitida.
4. O sistema deve mostrar o estado do vault ativo para a interface.
5. Erros de caminho, validação ou configuração devem aparecer de forma controlada.
6. A interface deve tentar abrir o vault padrão automaticamente sem exigir ação manual.
7. Na experiência desktop, um vault válido deve levar primeiro ao workspace, mantendo `setup`/`Home` como fallback e superfície informativa.
8. O bootstrap automático do vault padrão deve usar o mesmo contrato local de abertura reutilizado pelas demais ações da interface.
9. Enquanto o vault padrão ainda estiver carregando, a interface não deve liberar ações de escrita do workspace como se o vault já estivesse pronto.
10. A raiz retornada pelo bootstrap validado deve virar a única referência ativa usada pela interface desktop até o próximo reinício controlado.

## Pontos de atenção
- A criação do vault não deve presumir estrutura interna obrigatória além da raiz segura.
- A validação da raiz deve ser canônica e não apenas textual.
- A interface deve distinguir claramente entre vault ausente, vault inválido e vault ativo.
- A tela de `Home` pode exibir métricas e novidades, mas não deve substituir o workspace quando o vault já está pronto.
- O estado visual inicial não pode sugerir um workspace vazio pronto quando o vault ainda não terminou de abrir.
- O desktop não deve carregar uma raiz visual otimista e só alinhar com o backend depois de uma ação do usuário.

## Cenários

### Cenário 1: iniciar o vault padrão
Given a aplicação desktop inicia
When a interface carrega
Then o sistema busca o vault padrão configurado pelo app
And abre o vault padrão do app
And valida a fronteira
And marca o vault como ativo
And mostra o workspace como primeira superfície visível no desktop
And não exige prompt adicional para a operação principal

### Cenário 1b: bootstrap em andamento mantém estado controlado
Given a aplicação desktop iniciou mas o bootstrap do vault padrão ainda não terminou
When a interface do workspace fica visível
Then o sistema mantém um estado de carregamento ou vazio controlado
And não libera criação de nota, criação de pasta ou outras escritas antes de concluir a abertura
And só passa a tratar o vault como ativo após receber a raiz validada do fluxo de abertura

### Cenário 2: vault padrão indisponível
Given o vault padrão ainda não está disponível na sessão
When a interface carrega
Then a página de setup é apresentada
And o sistema permanece pronto para reabrir o vault assim que a raiz voltar a existir

### Cenário 3: caminho inválido é rejeitado
Given um caminho que escapa da fronteira permitida
When o sistema tenta validar a raiz
Then a operação é rejeitada
And o vault ativo não é alterado

### Cenário 4: vault sem seleção
Given nenhum vault configurado na sessão
When a interface carrega
Then a página de setup é apresentada
And nenhum comando de workspace é executado
