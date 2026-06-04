- [x] Definir a representação vetorial local de cada nota
- [ ] Construir índice incremental de relações e sinais de similaridade persistente
- [x] Adicionar comando `related` para listar notas relacionadas com score e motivo
- [x] Renderizar links manuais como navegação clicável na interface
- [x] Expor sugestões de links automáticos com preview antes de editar o markdown
- [x] Adicionar graph global com notas, pastas e leitura visual por contexto
- [ ] Validar performance, legibilidade visual e comportamento local-first em vaults maiores
- [x] Registrar a extração do graph local do workspace e dos controles da surface de relações para módulo dedicado do renderer
- [x] Registrar a extração da surface principal do graph global por ilhas e de seus handlers para módulo dedicado do renderer

## Estado real atual
- [x] `related` já existe como comando e usa score híbrido com sinais explicáveis
- [x] O serviço já expõe preview de aplicação de links antes da escrita no markdown
- [x] O graph global já existe com nós de nota, pasta e arestas manuais ou inferidas
- [ ] O índice de relações atual usa cache incremental em memória por vault; ainda não há persistência local explícita desse índice
- [ ] Ainda falta validação mais forte de performance e legibilidade em vaults maiores
