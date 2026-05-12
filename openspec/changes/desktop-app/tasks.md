# Tasks

## Foundation
- [ ] Definir o runtime do shell desktop em TypeScript
- [ ] Reusar o core atual sem duplicar regras de negócio
- [ ] Formalizar o contrato entre UI desktop e aplicação local

## Vault flow
- [x] Abrir automaticamente o vault padrão no desktop
- [x] Conectar a árvore de pastas e notas ao filesystem local
- [x] Conectar criar, editar, renomear e mover ao vault local
- [ ] Tratar fallback quando o vault padrão estiver ausente
- [x] Reusar o mesmo fluxo de `setup/open` no bootstrap automático do desktop
- [x] Bloquear ações de escrita até o vault ativo terminar de abrir
- [x] Sincronizar a raiz visual da UI com a raiz retornada pelo backend local
- [x] Refletir pastas vazias recém-criadas no refresh seguinte da árvore
- [x] Impedir que diálogos internos acumulem callbacks de sessões anteriores

## UI
- [ ] Levar a interface de setup e workspace para a janela desktop
- [ ] Manter navegação limpa, sem depender do navegador como produto final
- [ ] Preservar o visual discreto e a listagem limpa das notas
- [ ] Melhorar os ícones da sidebar com linguagem minimalista premium
- [ ] Exibir métricas e cards no setup de fallback
- [ ] Exibir card rotativo de novidades do projeto
- [ ] Refinar modais e encaixe visual do desktop
- [ ] Listar comandos disponíveis em um hub visual no desktop
- [ ] Adicionar busca global local para notas Markdown
- [ ] Adicionar modelos para novas notas e salvar como modelo
- [ ] Mostrar backlinks da nota aberta no painel auxiliar
- [ ] Permitir fixar notas e persistir a lista localmente
- [ ] Abrir a nota diária local do dia com um atalho rápido
- [ ] Exibir graph view local das conexões da nota ativa
- [ ] Mostrar rede local das notas da pasta selecionada no graph view
- [ ] Permitir zoom e drag no graph view
- [ ] Mostrar subpastas como nós azuis clicáveis no graph view
- [ ] Expor a ponte local de IA via CLI para contexto, busca e planejamento

## Quality
- [ ] Garantir operação local-first sem internet obrigatória
- [ ] Cobrir erros de configuração e fronteira com mensagens controladas
- [x] Atualizar specs conforme o comportamento desktop evoluir

## Notes
- O bug mais importante encontrado no fluxo desktop não era troca real de vault, mas bootstrap tardio combinado com ações de criação liberadas cedo demais.
- O backend já escrevia no vault padrão correto; o problema era a UI parecer pronta antes da árvore real ser carregada.
- O próximo agente deve preservar a regra: nenhuma escrita no desktop antes do vault ativo ficar explicitamente pronto.
