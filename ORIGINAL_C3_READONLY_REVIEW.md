# C3 — auditoria complementar somente leitura

**Atualização:** o JSON C3 e o complemento `10_storage_platform_readonly.sql` foram executados manualmente pelo usuário e analisados localmente. O suporte gerenciado a policies foi confirmado, sem trocar ownership. A conclusão vigente e o pacote 001–007 estão em [FINAL_INSTALL.md](FINAL_INSTALL.md). O manifesto C3 registra a preparação histórica; não substitui o manifesto atual do pacote SQL. Nenhuma alteração remota foi executada pelo agente.

Estado de 28/10/2026, branch `desenvolvimento`: **revisão local aprovada para coleta manual de metadados; implantação não autorizada**. Não houve conexão ao projeto original, aplicação de migrations, alteração de permissões/serviços, instalação ou operação Git de escrita. As migrations 001–006 e suas cópias preparadas, SQL 07/manifesto, cinco inventários e configuração do destino permanecem preservados.

## Arquivos e resultado esperado

- SQL independente: [supabase/original/08_c3_metadata_readonly.sql](supabase/original/08_c3_metadata_readonly.sql).
- Testes locais: [tests/original-c3.test.ts](tests/original-c3.test.ts).
- Manifesto de revisão: `.cache/original-review/c3/manifest.json`, com SHA-256 do SQL, teste e hashes do pacote 001–006 de referência. Não gera SQL de implantação nem concede aprovação.
- Resultado futuro: coluna JSON **`c3`**, a salvar em **`.secrets/original-c3.json`**. Esse arquivo não foi criado com dados inventados e ainda está pendente da execução manual. Não sobrescrever os inventários anteriores.

O SQL não contém chave, URL privada, connection string ou identificador fixo do projeto. A origem deve ser conferida no painel: um JSON com o rótulo C3 não comprova sozinho em qual projeto foi executado. O manifesto preserva a versão local revisada; não é atestado de execução remota.

SHA-256 do arquivo C3 revisado: `74637ed31e5cad8d1dc601c16b90989cc7ae7ce7a76f7a1aabfe2fc87c63c24e`.

## Grupos de verificações

| Grupo retornado | Conteúdo e finalidade |
|---|---|
| Guarda e `context` | READ ONLY, REPEATABLE READ, UTC, timeout de 60s/lock timeout de 5s, `search_path=pg_catalog`, `row_security=off`; acesso a 16 catálogos/views nativas, presença de anon/authenticated e vetor SHA-256. A guarda deve retornar 1 antes do JSON |
| `roles`, `memberships`, `schemas` | Papel efetivo atual do instalador, papel de origem da sessão e papéis SQL anon/authenticated/service_role; ownership, superuser/BYPASSRLS, USAGE/CREATE e grant option; memberships explícitas alcançáveis e opções ADMIN/INHERIT/SET. Não lê senhas ou registros Auth |
| `installation_relations` | Dez tabelas públicas, Storage objects/buckets e Auth users: presença/tipo, owner, autoridade imediata, possibilidade de SET ROLE, RLS do papel atual e grants efetivos. ACLs por tabela/coluna registram grantor, grantee e grant option |
| `sequences` | Sequências não sistêmicas: limites, incremento, cache, ciclo, owner, privilégios/ACLs e última fronteira reservada disponível em `pg_sequences`; dependências de ownership, defaults, funções e arestas de catálogo; cobertura da concessão de sequência feita pela 002 |
| `generators_and_auth_uid` | Assinaturas/owner/linguagem/SECURITY DEFINER/EXECUTE, hashes e defaults dependentes dos geradores conhecidos, trigger helper, RPCs portaria existentes e auth.uid. Não executa nenhuma dessas funções nem retorna seus corpos |
| `auth_relations`, `auth_id_reference_contract` | Metadados das tabelas Auth e contrato específico de users.id: UUID, NOT NULL, REFERENCES do instalador e índice único elegível para novas FKs |
| `auth_constraints`, `auth_indexes`, `auth_dependency_edges` | Constraints de/para Auth, validação/deferrabilidade, índices válidos/prontos/imediatos, PK/UNIQUE, partial/expression e dependências. Nomes/hashes/OIDs técnicos; nenhum UUID de conta ou registro pessoal |
| `managed_triggers`, `ddl_event_triggers` | Triggers de Auth/Storage e event triggers que podem influenciar futuras operações. Somente catálogo, sem disparar funções |
| `installer_default_acl_overrides` | Concessões padrão explícitas do papel atual, globais e em public/portaria, relevantes aos objetos novos. Não muda defaults nem afirma que ausência de override significa ausência dos defaults nativos |
| `checks`, `limits` | Verificações individuais `pass`, `blocked` ou `needs_review`, acompanhadas das limitações. `migration_execution_authorized=false` e `compatibility_approved=false` sempre |

Os OIDs retornados identificam objetos de catálogo apenas no banco consultado; não são identificadores de pessoas e não servem para reconstruir objetos em outro banco. Arestas genéricas de outros catálogos podem exigir resolução complementar; não se presume que nomes/hashes representem toda dependência de código dinâmico.

## Papel instalador e papéis da aplicação

O instalador auditado é **`current_user` da sessão que executar o arquivo**. `session_user` é registrado para distinguir a conexão original do papel efetivo. O SQL não troca papel, não concede privilégios e não usa credenciais administrativas da API. Se a instalação futura usar outro papel efetivo, esta coleta não comprova os direitos daquele outro papel.

`anon` e `authenticated` são papéis SQL da aplicação. Admin/porteiro são perfis funcionais futuros, normalmente sob `authenticated`, não papéis SQL equivalentes ao instalador. `service_role` é auditado somente como papel de servidor; sua presença não é obrigatória e nenhuma chave desse tipo é utilizada.

| Operação futura | Evidência de direito coletada | Interpretação |
|---|---|---|
| Criar schema portaria (001) | CREATE no banco atual | Sem direito, bloqueio; schema portaria já existente exige revisão de estágio |
| Criar funções públicas e funções SQL/PLpgSQL | CREATE em public e USAGE nas linguagens; presença/EXECUTE em auth.uid | Sem os direitos requeridos, bloqueio; não cria função de teste no original |
| ALTER, triggers e policies públicas/Storage | Owner ou privilégios do owner imediatamente disponíveis | SELECT não basta. Só poder SET ROLE não equivale a autoridade atual; o arquivo não faz essa troca |
| FKs para Auth | USAGE em auth, UUID NOT NULL e chave única elegível em users.id, REFERENCES na coluna | Não exige ownership de auth.users nem leitura das contas; PK deferrable não é aceita como evidência suficiente |
| GRANT/REVOKE e sequências da 002 | Owner/grant options/ACLs/membership e cobertura por dependência direta do default | Cadeias e grantors podem tornar a revogação incompleta ou fazê-la falhar. Não usar CASCADE como correção automática |

Ownership é avaliado por `pg_has_role(...,'USAGE')`, enquanto a possibilidade de assumir o papel é registrada separadamente por `'SET'`. São verificações do motor, não inferências baseadas apenas em nomes ou `rolinherit`. [PostgreSQL 17: funções de privilégios](https://www.postgresql.org/docs/17/functions-info.html), [membership](https://www.postgresql.org/docs/17/catalog-pg-auth-members.html).

## Capacidade de IDs e outras limitações

1. `pg_sequences.last_value` é a fronteira escrita/reservada; cache pode fazê-la exceder o último valor entregue. NULL pode significar sequência não usada, falta de USAGE/SELECT ou condição de standby. O C3 mantém NULL e não o converte em zero. [PostgreSQL 17: pg_sequences](https://www.postgresql.org/docs/17/view-pg-sequences.html).
2. `remaining_unreserved_positions` calcula posições além dessa fronteira, com incremento positivo/negativo e sem overflow; limites/valores são strings decimais para preservar bigint no JSON. **Zero não comprova exaustão**: ainda pode existir cache reservado. Em ciclos, a estimativa é NULL e se exige revisão de colisões. Concorrência e sequências não seguem o mesmo snapshot MVCC dos catálogos; não há capacidade exata garantida.
3. Capacidade da sequência não comprova quantidade de IDs válidos de negócio: formatação, comprimento, limites adicionais no corpo do gerador, resets antigos e unicidade podem limitar o uso. A coleta não lê códigos existentes, não executa `nextval`/`setval`/geradores e não testa a geração de um código real. Limites adicionais devem ser inspecionados no corpo da função no painel, sem executá-la ou exportar valores sensíveis. [Manipulação de sequências](https://www.postgresql.org/docs/17/functions-sequence.html).
4. A ausência de dependência em `pg_depend` não comprova independência de uma função PL/pgSQL ou SQL textual/dinâmico. A cobertura do GRANT da 002 é reproduzida conforme seu SELECT atual; `false` não significa necessariamente falta de USAGE já concedida. Confrontar as ACLs e revisar a função correspondente sem executá-la. [Rastreamento de dependências](https://www.postgresql.org/docs/17/ddl-depend.html).
5. Grants não comprovam acesso a todas as linhas sob RLS nem o comportamento de JWT/API/Storage. `row_security=off` é proteção contra leituras filtradas; não altera RLS das tabelas nem concede BYPASSRLS. Aqui não há leitura de nenhuma linha de aplicação/Auth/Storage.
6. ACLs por coluna também são mostradas porque `has_table_privilege` não basta para descrever uma concessão apenas na coluna. Isso não significa que a 002 precise ser alterada: REVOKE de privilégios de tabela também revoga os correspondentes nas colunas, sujeito a grantor/cadeias. A evidência remota ainda está pendente. [PostgreSQL 17: REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html).
7. Regras do provedor, permissões do painel/API, sessão real do instalador, concorrência DDL, Auth providers/signup/URLs/MFA/hooks, perfis ativos, publicidade de buckets e bytes dos documentos não são comprovados pelo C3. Não fazer DDL de teste nem alterar permissões para verificar essas hipóteses nesta etapa. Se ownership/gestão estiverem limitados pelo provedor, solicitar confirmação administrativa da operação proposta, sem credenciais no chat.
8. A guarda exige PostgreSQL >=17, para permitir teste do arquivo integral no motor local 18; o alvo conhecido continua PostgreSQL 17. Se o resultado manual indicar outra versão principal, interromper a conclusão de compatibilidade e revisar a divergência.

`pass` refere-se somente à condição daquele check. `blocked` impede aquela operação com o papel auditado. `needs_review` exige análise de contexto e não é aprovação tácita. Mesmo todos os checks em pass não autorizam instalação, não resolvem o histórico sem baseline anterior nem comprovam recuperação sem backup.

## Revisão de sintaxe, permissões e testes

Foram revisados recursos documentados para PostgreSQL 17: pg_sequence/pg_sequences, pg_auth_members, pg_index e elegibilidade de chave imediata, ACLs, default ACLs, funções de privilégios, deparsers e SHA nativo. A consulta usa aliases e tipos explícitos; lida com objetos ausentes por catálogo/LEFT JOIN, sem SELECT sobre auth.users ou qualquer tabela da aplicação.

Somente BEGIN READ ONLY, SET LOCAL, SELECT/WITH e ROLLBACK. Todas as funções chamadas são nativas qualificadas com pg_catalog; COALESCE, CASE, GREATEST e EXISTS são construções SQL. Não há query_to_xml, EXECUTE, SQL dinâmico, função da aplicação, pg_authid/rolpassword, acesso a sistema de arquivos ou HTTP. Definições necessárias à comparação são processadas somente para hashes, sem exportar corpos/expressões que possam conter valores sensíveis.

É necessário SELECT nos 16 catálogos/views listados e EXECUTE nas funções nativas usadas; não é necessário SELECT em contas Auth ou documentos. O primeiro SELECT verifica o contexto, catálogos, papéis e o SHA; falha de permissão em qualquer fase aborta a transação, sem fallback ou concessão de privilégios. Não usa XML e não requer pgcrypto.

**44 testes locais aprovados, zero falhas/skips:** 21 novos de C3, 22 do comparador e um de hashes das seis fontes. C3 cobriu execução integral, aliases/tipos, ausência de dados privados nos resultados, sequências sem avanço/is_called alterado, cache, ciclo, incremento negativo, bigint, ownership/defaults, direitos de instalador versus aplicação, herança versus SET ROLE, REFERENCES por coluna, Auth PK deferrable, objeto ausente, default ACLs, event triggers sem chamada e falhas de permissões/catálogos/papéis. Lint e TypeScript passaram.

```powershell
node --no-warnings --experimental-strip-types --test tests/original-c3.test.ts tests/original-preflight.test.ts tests/original-sources.test.ts
```

Os testes usam PostgreSQL WASM/PGlite **18** em memória, objetos gerenciados simulados e fixtures fictícias. DDL/DML/GRANT/SET ROLE existiram apenas na montagem desses testes locais, nunca no SQL C3 ou no original. Não foi instalado/consultado um servidor 17, aplicado o pacote 001–006 ou feito ensaio de restauração nesta rodada. A compatibilidade sintática com 17 está fundamentada na documentação e precisa da confirmação manual do ambiente real.

## Execução manual, após esta revisão local

1. Conferir no painel o projeto original correto. Usar a sessão/papel efetivo do SQL Editor que se pretende utilizar futuramente como instalador; não trocar papéis, elevar privilégios ou fornecer senhas/tokens ao chat.
2. Abrir **somente `supabase/original/08_c3_metadata_readonly.sql`**. Comparar SHA-256 com `.cache/original-review/c3/manifest.json`, se necessário: `Get-FileHash -Algorithm SHA256 -LiteralPath .\supabase\original\08_c3_metadata_readonly.sql` é leitura local. Não usar `original:preflight-prepare`.
3. Executar o arquivo inteiro em uma consulta, sem selecionar só o JSON final. Ele começa em READ ONLY, aplica apenas ajustes de sessão, deve retornar **`c3_catalog_guard=1`**, retorna a coluna **`c3`** e termina em ROLLBACK. Não juntar migrations, comandos de painel ou scripts DEV.
4. Se houver `22012`, a guarda não foi satisfeita. `42501` indica permissão insuficiente; `57014`/`55P03` indicam timeout/lock. Parar e informar apenas código e etapa, sem dados privados. Não pular guardas, executar o restante isolado, conceder acesso ou contornar restrições. Se a sessão ficar abortada, encerrá-la com ROLLBACK antes de outra consulta.
5. Em sucesso, confirmar `audit=original_complement_c3`, `format_version=1`, `server_major=17`, contexto somente leitura e identidade técnica do instalador esperado. Salvar somente o JSON completo da coluna `c3` em **`.secrets/original-c3.json`** (JSON direto ou exportação de uma linha com a coluna c3). Não salvar CSV, não sobrescrever o preflight 07 e não colar conteúdo no chat. O arquivo é privado/ignorado pelo Git.
6. Avisar que foi salvo. A etapa seguinte será análise local dos checks/ACLs/dependências e correlação com os inventários anteriores e hashes do pacote; **não será execução automática**. Resultado de C3 ainda não existe nem está aprovado.

## Checklist

- [x] SQL C3 separado, revisado e testado localmente.
- [x] Sequências, Auth e direitos do papel instalador cobertos no escopo definido.
- [x] Leituras pessoais, chamadas de geradores, SQL dinâmico e escrita ausentes.
- [x] 44 testes locais aprovados; lint e TypeScript aprovados.
- [x] Manifesto C3 preparado; seis migrations, SQL 07 e arquivos privados preservados por hash.
- [ ] Execução manual do C3 no projeto original e confirmação da guarda/papel.
- [ ] JSON C3 salvo e analisado localmente; divergências e bloqueios reais ainda não conhecidos.
- [ ] Resolver achados antes de revisão final e autorização específica de qualquer operação remota de escrita.

Nenhum perfil foi liberado. Nenhuma autorização de implantação, Auth/Storage/RLS, migrations, publicação ou exclusão de registros resulta desta preparação.
