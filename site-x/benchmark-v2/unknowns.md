# Site X Benchmark v2 Known, Inferred, Unknown

## Known

- Next.js 15 App Router, TypeScript strict, PostgreSQL/Prisma, Auth.js magic link/JWT, Server Actions e `/api/v1` são arquitetura documentada.
- Papéis: OWNER, ADMIN, RESEARCHER e VIEWER. RBAC é imposto no servidor e em toda query por `workspaceId` autorizado.
- Entidades, rotas API atuais, limites de validação de evidência, metas a11y/performance, SEO e estratégia de testes estão documentados.
- Prioridades formais: P0 para auth, workspace, projeto, sessão, evidência, tema, dashboard e NFRs; P1 para busca, notificações e exportação.
- O benchmark possui PostgreSQL e Mailpit locais, descartáveis e sem credenciais externas; ver `local-infrastructure.md`.
- Prisma, migration local e seed determinístico persistem User, Workspace, Membership, Project, Participant, Session, Evidence, Theme e ThemeEvidence no PostgreSQL do benchmark.

## Inferred

- V2 deve usar ambiente isolado para banco e testes de integração, pois documentação exige banco de teste isolado. Nome, host, credenciais e serviço não foram inferidos.
- Testes temporais de REQ-NOTIF-001 precisam relógio controlável para provar janela de 24 h. Isso é técnica de teste, não decisão de produto.
- REQ-SEARCH-001 exigirá contrato API/indexação adicional antes de aceite completo, porque campos e UX estão documentados, mas rota/contrato não.

## Unknown

### Críticos para benchmark

- Produção: `DATABASE_URL`, host PostgreSQL, estratégia de provisionamento/migração e credenciais de ambiente.
- Produção: provider SMTP/email, configuração Auth.js, segredo Auth.js, remetente/domínio e ambiente seguro para links reais. Mailpit local foi autorizado somente para benchmark.
- Host/deploy, domínio de ambiente, política de variáveis, TLS/HSTS e acesso à telemetria RUM.
- Canal, provider, template, agendamento, reenvio e regras de deduplicação para REQ-NOTIF-001.
- Contrato, paginação, ranking e índice da API para REQ-SEARCH-001.
- Colunas CSV, filtros, encoding, nome de arquivo e mecanismo de download para REQ-EXPORT-001.

### Necessários antes de aceite final

- Fonte de dados e fórmula de "tarefas de síntese" do dashboard.
- Regra de domínio para garantir que `Session.participantId`, quando presente, pertença ao mesmo projeto da sessão. Documentação modela ambos os vínculos, mas não declara constraint cross-project.
- Definição completa de restaurar projeto arquivado e endpoint correspondente.
- Contratos API para perfil, troca/remoção de membro e billing/limites, embora UI/settings os descreva.
- Ambiente/contas de teste para NVDA/Chrome, VoiceOver/Safari, Lighthouse CI e RUM produção.
- Regras de retenção operacional, mecanismo de remoção de participante e formato/destino do audit log além da exigência de segurança.

Nenhum segredo, credencial, provider, serviço ou valor de produção foi criado ou presumido.
