# Spec Delta: desktop-shell

## ADDED Regras
1. O `Modo dev` deve expor `orion` como executável físico disponível no `PATH` da sessão e de shells filhos.
2. O launcher `orion` deve chamar somente a CLI compilada fora de `app.asar` e preservar argumentos, entrada padrão e código de saída.
3. O desktop deve iniciar OpenCode com prompt de sessão e Claude Code com prompt de sistema, sem criar arquivos persistentes no vault do usuário.
4. A raiz ativa controlada pelo processo principal deve ser a única raiz usada por Terminal Orion, OpenCode e Claude Code.
5. O shell desktop deve manter barra superior e cabeçalho do painel auxiliar fixos enquanto conteúdo interno do workspace rola.

## ADDED Cenários

### Cenário 1: launcher disponível para subprocesso de agente
Given o terminal foi aberto pelo `Modo dev` em uma instalação Windows
When OpenCode ou Claude Code inicia um shell filho
Then o shell encontra `orion` pelo `PATH`
And `orion /start` executa a CLI compilada sem `tsx`

### Cenário 2: OpenCode recebe onboarding de sessão
Given OpenCode está instalado e existe um vault ativo
When o usuário escolhe `OpenCode no vault`
Then OpenCode inicia no vault ativo com onboarding do Orion Vault
And o agente é instruído a iniciar por `orion /start` e `orion /skills`

### Cenário 3: Claude Code recebe prompt de sistema
Given Claude Code está instalado e existe um vault ativo
When o usuário escolhe `Claude Code no vault`
Then Claude Code inicia no vault ativo com contexto do Orion Vault como prompt de sistema
And a sessão inicia o catálogo de skills antes de aguardar pedido do usuário

### Cenário 4: workspace longo não desloca navegação
Given árvore, editor ou painel auxiliar excedem altura da janela desktop
When o usuário rola uma dessas superfícies
Then barra superior e cabeçalho do painel auxiliar permanecem visíveis
And rolagem visual pode permanecer oculta sem impedir mouse, touchpad ou teclado
