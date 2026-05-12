- [x] Atualizar spec com escopo desktop-only e browser futuro
- [x] Adicionar view de agenda e botão na sidebar
- [x] Criar notas com frontmatter de prazo e status
- [x] Listar itens com filtros de estado e ações rápidas
- [x] Emitir notificações nativas para 1 dia, 1 hora e horário do prazo
- [x] Validar a integração sem quebrar o workspace atual
- [x] Fixar `Agenda/` como pasta estrutural do vault
- [x] Garantir criação e listagem da agenda a partir de `Agenda/`

## Notes
- A agenda não deve depender de uma pasta “eventual” criada pelo usuário; `Agenda/` precisa existir como convenção estrutural do vault.
- A criação deve escrever diretamente em `Agenda/<data>-<slug>.md`.
- A listagem deve continuar mostrando os itens mesmo após refresh/navegação, usando `Agenda/` como origem única.
