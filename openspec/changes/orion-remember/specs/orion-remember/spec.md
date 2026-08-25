# Spec: orion remember

## Regra de negocio
Sistema deve permitir registrar conhecimento persistente no Orion somente para informacao que usuario pediu explicitamente salvar, sem expor filesystem ao Agent e sem sobrescrever notas silenciosamente.

## Requirements
1. Tool publica futura deve aceitar somente:

```json
{
  "content": "string",
  "subject": "string opcional",
  "project": "string opcional",
  "kind": "string opcional"
}
```

2. `content` deve ser obrigatorio e nao vazio. `subject`, `project` e `kind` sao hints semanticos, nao comandos autoritativos. `kind` nao deve ter enum fechado no MVP.
3. Schema publico nao deve expor `path`, `vaultRoot`, `vaultRoots`, operacao CRUD, overwrite ou qualquer input de filesystem.
4. Escrita exige pedido explicito atual de salvar, registrar, anotar ou guardar. Selecao do Agent, leitura anterior, inferencia do Agent ou comentario sobre importancia nao autorizam escrita.
5. Autorizacao de escrita cobre somente informacao referida pelo pedido; nao cobre conclusoes adjacentes ou futuras.
6. Sistema deve usar somente `ORION_WRITE_VAULT_ROOT` como destino. Configuracao deve existir, ser valida e pertencer aos read roots efetivos.
7. Falta de write target deve retornar erro seguro `WRITE_TARGET_NOT_CONFIGURED`. Write target fora dos read roots deve retornar `WRITE_TARGET_NOT_READ_SOURCE`. Nenhuma condicao permite escrita por fallback em root prioritaria.
8. Candidatos de remember devem ser buscados somente no write target. Busca lexical/hibrida, retrieval e relacoes semanticas servem como sinais, nunca como decisao unica de equivalencia ou append.
9. Sistema deve normalizar `content`, `subject`, `project` e `kind` quando presentes e gerar fingerprint logico da assertiva.
10. Acoes MVP permitidas sao somente `noop`, `created`, `appended` e `conflict`.
11. `noop` deve ocorrer quando conhecimento equivalente ja existir e nao pode alterar arquivo.
12. `created` deve ocorrer somente sem destino confiavel e nunca pode sobrescrever arquivo existente.
13. `appended` deve ocorrer somente para nota canonica unica e adicao segura, delimitada e nao contraditoria. Conceitualmente nao representa replace do arquivo.
14. `conflict` deve ocorrer para destinos multiplos, semelhanca ambigua, contradicao potencial, edicao ampla, tentativa fora de escopo ou mudanca concorrente.
15. Paths internos devem respeitar fronteira do write target, protecao contra traversal e restricao a Markdown. Respostas nunca devem expor paths absolutos.
16. Remember deve preservar estilo Markdown da nota alvo. Nao deve criar formato universal nem adicionar frontmatter, tags, kind, project ou provenance automaticamente.
17. Resposta de `created` ou `appended` deve conter `action`, identificador seguro ou path relativo em `note`, `summary` e `source: user-explicit-agent`. `noop` deve conter `reason: equivalent_knowledge_exists`; `conflict` deve conter `reason`, candidatos seguros e `nextStep`.

## Invariants
- Nenhuma escrita ocorre sem pedido explicito atual de escrita.
- Autorizacao de leitura nao se converte em autorizacao de escrita.
- Nenhuma operacao sai do write target nem escreve em mais de um Vault.
- Create nunca sobrescreve; append nunca remove ou substitui conteudo nao relacionado.
- Similaridade semantica isolada nunca decide equivalencia ou append.
- Mudanca externa entre leitura e escrita nunca e sobrescrita silenciosamente.
- Testes nao devem alterar Vault real sem autorizacao explicita; usar Vault temporario ou fixture isolada.

## Scenarios

### Cenario A: pedido explicito de salvar
Given usuario diz "Salve no Orion que a Lauren usa PostgreSQL"
When Agent chama remember com assertiva referida
Then sistema busca somente no write target
And retorna `noop`, `appended`, `created` ou `conflict` conforme decisao conservadora

### Cenario B: afirmacao sem pedido de salvar
Given usuario diz "Essa arquitetura usa PostgreSQL"
When Agent analisa conversa
Then remember nao e chamado
And nenhum Vault e alterado

### Cenario C: leitura anterior nao autoriza escrita
Given usuario autorizou "Veja minhas notas sobre Lauren"
And Agent leu contexto
When usuario diz "Isso confirma que PostgreSQL e melhor"
Then remember nao e chamado
And nenhum Vault e alterado

### Cenario D: decisao referida no contexto atual
Given discussao atual contem uma decisao identificavel
When usuario diz "Guarde essa decisao no Orion"
Then remember registra somente decisao referida
And nao registra conclusoes adjacentes inferidas pelo Agent

### Cenario E: mesma assertiva repetida
Given conhecimento equivalente ja foi salvo no write target
When mesma assertiva e solicitada novamente
Then resposta tem `action: noop`
And `reason` e `equivalent_knowledge_exists`
And nenhum arquivo e alterado

### Cenario F: conhecimento semelhante existente
Given candidatos semelhantes existem no write target
When equivalencia ou destino nao forem inequivocos ou houver contradicao potencial
Then resposta tem `action: conflict`
And solicita confirmacao ou esclarecimento
And append automatico ocorre somente para destino canonico unico e seguro

### Cenario G: dois Vaults configurados
Given dois read roots estao configurados e um write target valido existe
When remember procura candidatos e persiste conhecimento
Then procura e escrita de remember usam somente write target
And outro Vault nao recebe copia

### Cenario H: tentativa de path malicioso
Given Agent tenta enviar `../../foo.md`
When schema publico e validado
Then propriedade `path` e rejeitada
And nenhum arquivo e alterado

### Cenario I: tentativa de replace inteiro
Given Agent tenta substituir uma nota inteira
When remember avalia pedido
Then retorna rejeicao ou `conflict`
And nunca sobrescreve silenciosamente

### Cenario J: write target ausente
Given `ORION_WRITE_VAULT_ROOT` nao esta configurado
When remember e chamado apos pedido explicito
Then retorna erro seguro `WRITE_TARGET_NOT_CONFIGURED`
And nenhum Vault e alterado

### Cenario K: write target invalido
Given `ORION_WRITE_VAULT_ROOT` nao pertence aos read roots efetivos
When remember e chamado
Then retorna erro seguro `WRITE_TARGET_NOT_READ_SOURCE`
And nenhum Vault e alterado

### Cenario L: nota muda durante append
Given remember leu nota canonica e preparou append com fingerprint base
When conteudo da nota muda antes da escrita
Then sistema recalcula seguramente ou retorna `conflict`
And nao sobrescreve mudanca externa

## Out of scope
- delete, move, rename, replace arbitrario, overwrite e edicao livre
- bulk write, sync, cloud, remote MCP e versionamento de notas
- taxonomia obrigatoria de memories e provenance persistida
- escrita em multiplos Vaults e escolha de path pelo Agent

## Acceptance criteria
1. Schema nao expoe paths, roots, operacao ou filesystem.
2. Ausencia ou invalidade do write target bloqueia escrita com erro seguro.
3. Um unico write target recebe toda escrita; nenhum outro Vault recebe copia.
4. Dedupe exato retorna `noop` sem mutacao.
5. Create nao sobrescreve arquivo existente.
6. Append ocorre somente para destino unico, seguro e nao contraditorio.
7. Similaridade ambigua retorna `conflict`.
8. Mudanca concorrente nao e sobrescrita silenciosamente.
9. Leitura anterior, selecao do Agent ou ausencia de pedido explicito nao permitem escrita.
10. Respostas nao expoem paths absolutos.
11. Testes usam Vault temporario ou fixture isolada e nao escrevem em Vault real sem autorizacao explicita.
