# Validação local final do original — 28/10/2026

**Etapa final vigente:** [FINAL_INSTALL.md](FINAL_INSTALL.md). C3/complemento recebidos, óleo implementado e pacote ampliado para 001–007/contrato 5. A análise abaixo registra a revisão anterior de 001–006; as alterações finais em 002/004 e os hashes atuais estão no pacote local de revisão. Nenhuma migration remota ou publicação foi realizada.

**Correções locais C1/C2 concluídas; implantação ainda bloqueada por evidências e autorizações pendentes.** O snapshot recebido é válido e os metadados comparáveis não mostram mudança real desde as auditorias. A 002 foi corrigida localmente para fechar os privilégios residuais de `drivers`; o comparador distingue divergência, cobertura reconciliada e evidência insuficiente. Isso não comprova compatibilidade integral nem altera o estado remoto.

Esta revisão leu os cinco JSONs locais de auditoria, o SQL 07/revisão 2, os seis templates incrementais, suas seis cópias renderizadas, manifestos, scripts de comparação e contratos do frontend. Após autorização específica, foram alterados somente a migration 002, sua cópia preparada, comparador/testes, hashes/manifestos e documentação. Nenhuma consulta remota, migration remota, alteração de perfil, download documental, instalação ou operação Git de escrita foi executada. As execuções SQL de teste ocorreram somente em memória com fixtures fictícias. **001, 003–006, SQL 07, cinco JSONs de auditoria, destino e código funcional do frontend permaneceram inalterados.** Este relatório não substitui os inventários privados.

## 1. Resultado do JSON e guardas

- JSON completo válido, com 18 campos principais esperados; `format_version=1`, `preflight_revision=2`, PostgreSQL 17.
- Snapshot de **28/10/2026 às 08:44:23, America/Sao_Paulo**; horário do inventário interno igual ao do resultado principal.
- Transação declarada `read only`, isolamento `repeatable read`, `row_security=off` e `search_path=pg_catalog, public, extensions`.
- EXECUTE em `query_to_xml` e `sha256` confirmado no resultado; indicação de guarda nativa anterior à leitura presente.
- Doze relações esperadas, presentes, selecionáveis, com USAGE e leitura sem filtragem RLS efetiva para o papel da coleta; zero relações com RLS efetivamente ativa nesse papel.
- Isso **não significa RLS desabilitada**: as dez tabelas públicas continuam com RLS habilitada. O resultado reflete o papel autorizado da auditoria, não os privilégios do navegador.
- `portaria` e `portaria.release_state` ausentes, coerentes com nenhuma das seis candidatas aplicada.
- Hash local do SQL 07, hashes das cinco fontes, rótulo de destino, fingerprint estrutural e integridade dos candidatos conferidos.

As duas guardas retornam resultados separados do JSON. Seus valores `1` não estão embutidos no arquivo salvo; a evidência disponível é a execução integral bem-sucedida informada pelo usuário, junto com as capacidades, contexto e cobertura coerentes do snapshot. O hash do rótulo não é atestado do servidor sobre a identidade do projeto. O resultado é uma fotografia do momento informado e não prova o estado de uma janela futura.

O destino local permanece `original` / `metadata-only`, sem release. O campo geral `remoteEnabled` está `true`, mas o SDK rejeita explicitamente `metadata-only` antes de criar cliente. Não foi alterado nem contornado esse bloqueio; frontend original e escrita continuam sem liberação.

## 2. Comparação com as auditorias anteriores

| Escopo inventariado | Atual | Resultado da comparação |
|---|---:|---|
| Tabelas públicas | 10 | Iguais; todas com PK e RLS habilitada |
| Colunas | 146 | Iguais, incluindo hashes de defaults |
| Constraints | 38 | Iguais; todas validadas |
| Índices | 60 | Iguais; todos válidos |
| Funções públicas | 3 | Corpos/hashes e atributos iguais; ressalva documental abaixo |
| Triggers não internos | 16 | Iguais; nenhum desabilitado |
| Policies | 57 | Iguais; 41 têm USING ou CHECK incondicional |
| Grants de tabelas no escopo | 172 | Iguais; excesso de privilégios continua existente |
| Buckets | 4 | Iguais, incluindo configuração de publicidade |
| Versões do ledger | 21 | Iguais; não são as seis candidatas novas |
| Publicações, presença Auth e contrato gerenciado | — | Iguais no escopo coletado |
| Checks de integridade | 14 | Todos os valores iguais |
| Agregados documentais/Storage | — | Iguais |

Na revisão anterior, `npm run original:preflight-compare` retornava `drift_detected`/exit 1 exclusivamente na coleção de funções. O primeiro inventário não possui os campos `anon_execute` e `authenticated_execute`; eles já existem no inventário complementar 00b. O comparador corrigido consulta as duas fontes anteriores por schema/nome/argumentos e as compara com as duas fontes atuais, sem alterar os JSONs de entrada.

Resultado local atual: **`catalog_and_aggregates_match_manual_review_required`, exit 0**, com `functionComparison.status=coverage_reconciled`, seis campos de EXECUTE reconciliados, zero campos divergentes, zero campos insuficientes/conflitantes e hashes estruturais coincidentes. A situação anterior fica registrada neste relatório; o agregado `comparison.json` foi atualizado para o resultado corrente. `migrationExecutionAuthorized` e `finalCompatibilityApproved` continuam **false**.

Uma mudança real de permissão ou definição continua `drift_detected`. Quando a função não tem evidência de EXECUTE suficiente, o resultado é `insufficient_audit_evidence`, com `matches=null`, nunca aprovação presumida. Fontes contraditórias ou duplicadas também bloqueiam a conclusão. Se existir simultaneamente drift real em outro escopo, ele continua visível e tem prioridade no status. O snapshot atual permanece sem baseline anterior equivalente de conteúdo histórico.

### Integridade, histórico e digests

Duplicidades de placas/aberturas, conflito entre fluxos, incompatibilidade de pátio, placas incompatíveis e órfãos testados continuam em zero. Os totais históricos permanecem **185 registros legados, 144 movimentações e 90 acessos**. Esses checks não cobrem toda combinação possível de campos inválidos nem todas as FKs do serviço.

Permanecem **17 veículos fora sem abertura correspondente**: dois ativos, cinco em manutenção e dez inativos. São casos conhecidos de revisão operacional, não autorização de corrigir `in_patio`, inventar saídas ou excluí-los. A conferência deve manter estado esperado desconhecido quando a reconstrução não for segura.

| Tabela | Linhas no snapshot atual |
|---|---:|
| `access_records` | 90 |
| `drivers` | 95 |
| `operational_checklist_items` | 1.674 |
| `operational_movements` | 144 |
| `operational_photos` | 78 |
| `people` | 187 |
| `personal_vehicles` | 26 |
| `vehicle_inspection_requests` | 3 |
| `vehicle_records` | 185 |
| `vehicles` | 64 |

Há dez digests SHA-256 agregados válidos e nomes de tabela únicos. **Não existe baseline anterior equivalente de preservação entre os arquivos disponíveis.** Portanto, não é possível provar agora igualdade histórica dos IDs/conteúdo por digest; contagem igual não basta. As três contagens históricas acima e o agregado anterior de 78 fotos são comparáveis; os demais totais passam a ter baseline completo neste snapshot.

Os digests são úteis como T0 para uma janela posterior controlada. Devem ser comparados usando a mesma projeção de colunas, serialização e contexto: a adição dos seis campos de autoria foi excluída da projeção original deliberadamente. Escritas legítimas entre snapshots exigem reconciliação; diferença não deve ser ignorada nem classificada automaticamente como perda. Não há prova de integridade dos bytes do Storage nesses digests.

### Storage e documentos

| Bucket existente | Visibilidade atual | Objetos | Bytes informados |
|---|---|---:|---:|
| `access-documents` | Privado | 87 | 94.215.862 |
| `driver-cnh-documents` | Público | 65 | 19.094.786 |
| `person-documents` | Privado | 5 | 1.413.076 |
| `vehicle-operation-photos` | Público | 79 | 262.869.380 |
| **Total** | | **236** | **377.593.104** |

Os quatro buckets não têm limite de tamanho/MIME configurado no inventário; seus 236 objetos não têm `owner_id`. Isso não autoriza inventar owners ou bloquear a leitura legada exclusivamente por owner. As políticas preparadas distinguem leitura legada e autoria das novas evidências.

As 65 referências HTTP(S) documentais têm path e correspondência única nos metadados dos buckets candidatos, sem ambiguidade ou ausência. Isso **não prova que todas as URLs sejam públicas, válidas ou recuperáveis**. Não houve acesso às URLs ou ao conteúdo. As referências de acessos (87), fotos de movimentos (78) e pessoas (70) também têm correspondência única. A diferença 79 objetos/78 referências de fotos não autoriza concluir que há exatamente um arquivo órfão nem apagar arquivo algum.

`portaria-evidence` e `portaria-parcels` ainda não existem. São pré-requisitos futuros, não criados pelas migrations. A 004 deverá recusar execução enquanto os quatro buckets legados não estiverem privados; hoje dois continuam públicos.

### Auth e permissões de instalação

`auth.users`, `auth.identities` e as colunas gerenciadas esperadas estão presentes e iguais ao inventário complementar. Não foram lidas contas. Este inventário não prova configuração de providers/signup/URLs/MFA/hooks, existência de administrador operacional nem vínculo com `portaria.profiles` (ainda inexistente).

O escopo de constraints inclui tabelas da aplicação, não a PK/UNIQUE completa de `auth.users`. Também não prova ownership/ALTER/CREATE/REFERENCES necessários para instalar objetos e policies, privilégios herdados de todos os papéis, default privileges, grants/estado/capacidade de sequências ou configuração de exposição de schemas da API. Acesso de SELECT no SQL Editor não comprova esses direitos. Verificação complementar apenas de metadados deverá ser autorizada antes da aprovação final do pacote.

## 3. Matriz das candidatas 001–006

Os hashes foram atualizados após a correção autorizada: **somente 002 mudou**, no template e na cópia preparada. 001 e 003–006 permaneceram idênticas byte a byte, inclusive nas cópias renderizadas. O pacote continua com aprovação/recuperação pendentes; hashes íntegros não significam SQL aprovado.

| Candidata | Dependências e aderência ao snapshot | Preservação e segurança | Parecer |
|---|---|---|---|
| **001 Foundation** | Fingerprint atual coincide; nenhum schema/marcador inesperado; nenhuma das três funções públicas é SECURITY DEFINER. Requer privilégios DDL/FK, recuperação/dispensa registrada e aprovação específica | Cria somente objetos novos privados; FKs RESTRICT; não importa nem reescreve linhas antigas | Estruturalmente compatível no escopo; condicionada às evidências e aprovação |
| **002 Authorization** | Depende de 001, contrato 1/2; tabelas/colunas antigas esperadas existem | Acrescenta seis campos de autoria sem preenchimento histórico, defaults futuros e gates cumulativos; relaxa NOT NULL de validade CNH operacional; preserva IDs. Agora revoga ALL de `drivers` para PUBLIC/anon/authenticated, além da policy restritiva | **Correção local concluída e testada**; execução remota ainda não aprovada |
| **003 Operations** | Depende de 001/002 e bucket privado `portaria-evidence`, 10 MiB, JPEG/PNG/WebP; esse bucket está ausente | Confirmação Cobli selecionada, assinatura obrigatória, motivo/seis fotos quando não associado, autoria real; alterações operacionais acontecem nas chamadas futuras. Visitantes com evidência privada; não reescreve checklist antigo | Contrato gerenciado compatível; pré-requisito Storage ainda pendente |
| **004 Private files** | Depende do contrato 2 e quatro buckets legados privados; dois ainda públicos | Revoga acesso amplo/gestão de Storage, protege objetos/caminhos legados, resolve documentos sem fallback público. URLs persistidas são preservadas, mas links públicos podem deixar de servir conteúdo | Compatível de forma condicionada; **guarda falharia no estado atual**, como previsto |
| **005 Daily yard/parcels** | Depende de 001–004 e `portaria-parcels` privado, 10 MiB, JPEG/PNG/WebP; bucket ausente | Novas tabelas/eventos, retirada atômica/idempotente, conferência congelada por referência; nenhum recadastro ou correção automática dos 17. Eleva contrato a 3 | Sem conflito novo de estrutura identificado; pré-requisitos pendentes |
| **006 Physical checks/timeline** | Depende da 005/contrato 3; aceita reaplicação limitada ao estágio 4 | Acrescenta significado às conferências antigas, troca constraint própria sem apagar resultados, captura somente autoria futura e última saída segura; eleva contrato a 4 | Compatível com a 005 preparada; validade runtime continua sujeita a testes e instalação autorizada |

O frontend atual exige **contrato 4**, correspondente ao término de 006. Não deve ser conectado a um pacote parcialmente aplicado. 001–006 têm guardas de estágio; não são um conjunto irrestritamente reaplicável em qualquer ordem. A checagem da 005 é pertinente antes de 006; após 006 o postflight final é o 06.

Não foram identificados comandos para apagar as dez tabelas, recriar banco, truncar histórico, reiniciar suas sequências ou excluir documentos durante instalação. Existem substituições de funções e drops de policies/triggers próprios; a 006 remove a constraint anterior que ela substitui. Esses são DDL com impacto real, mesmo sem apagamento de registros. A preservação projetada não equivale a ensaio das seis sobre uma cópia do banco real.

## 4. Correções locais autorizadas e evidência pendente

### C1 — Privilégios residuais em `drivers`: corrigido localmente

O snapshot concede a `anon` e `authenticated` SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER nessa tabela, com 95 registros. A versão anterior da 002 adicionava policy restritiva falsa, mas sua lista de REVOKE percorria apenas as outras nove tabelas. **RLS não controla TRUNCATE nem REFERENCES.** Isso não comprova existência de endpoint REST de TRUNCATE; comprova o privilégio residual corrigido no candidato local. O original permanece sem alteração. [PostgreSQL 17: alcance de RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Comando incorporado no bloco específico de `drivers`, dentro da transação existente e sem CASCADE:

```sql
REVOKE ALL ON public.drivers FROM PUBLIC, anon, authenticated;
```

Tabela, registros, PK/FKs e policy de fechamento são preservados. `operationalService.listDrivers`, cadastros e edição usam `people`; as variáveis chamadas drivers e o tipo legado não significam acesso à tabela antiga. Nenhuma chamada direta à tabela `drivers` foi encontrada nos serviços atuais, nem dependência de dados dessa tabela nas outras cinco migrations. Clientes externos não são verificáveis por essa busca e continuam uma limitação; não reabrir acesso anônimo para atender cliente antigo.

Testes em memória criaram **95 motoristas inteiramente fictícios** e grants excessivos para PUBLIC/anon/authenticated. A aplicação/reaplicação preservou todos os campos, IDs e digests. Os sete privilégios de tabela ficaram negados para anon/authenticated e para um papel de prova que recebia acesso somente via PUBLIC. Tentativas de TRUNCATE por anônimo/admin/porteiro falharam com `42501`. Uma cópia da 002 terminada em ROLLBACK confirmou que a revogação é transacional; o arquivo candidato não foi alterado pelo teste. Os fluxos atuais de cadastro, Cobli, assinatura, entradas e saídas continuaram passando.

Foram recalculados hashes e regeneradas cópias pelos scripts locais existentes, sem recibo de aprovação. Qualquer autorização anterior baseada em hashes da 002/pacote antigo não serve para estes bytes novos.

### C2 — Gate local de comparação: corrigido e testado

O comparador agora reconcilia apenas os dois campos de EXECUTE com fontes do mesmo lado temporal, por assinatura completa. Não usa o estado atual para preencher o passado, nem o contrário; não transforma ausência em false. Definição/hash, SECURITY DEFINER e demais atributos continuam sendo comparados integralmente. Complemento sem correspondência, duplicado ou contraditório não produz conclusão positiva.

Foram acrescentados testes para drift real, ausência parcial/total, overload/schema diferente, fontes conflitantes/duplicadas, evidência malformada e convivência de drift com evidência insuficiente. O comparador exige revisão 2, capacidades nativas, contexto protegido, USAGE e RLS efetiva. Relatórios e erros continuam sem nomes de funções fornecidos pela entrada, documentos ou fragmentos privados.

**O gerador não foi alterado nesta autorização.** Continua pendente sincronizar `original:preflight-prepare` com o SQL revisado; não usá-lo enquanto isso. A revisão 2 manual e seu manifesto foram preservados.

### C3 — Completar evidências de sequências, Auth e papel instalador

**Preparação C3 concluída localmente:** [SQL separado, escopo, testes, limitações e instruções manuais](ORIGINAL_C3_READONLY_REVIEW.md). O arquivo `supabase/original/08_c3_metadata_readonly.sql` não é migration, não altera as candidatas e não foi executado no original. A coleta/JSON `.secrets/original-c3.json` e a análise dos resultados continuam pendentes. A preparação não resolve por si só as lacunas abaixo.

As funções `generate_short_code` e `generate_vehicle_mobile_code` continuam com EXECUTE para `anon`/`authenticated`; a 002 não restringe essas funções antigas. Os arquivos históricos locais usam `nextval`; o gerador de veículos referencia uma sequência limitada a 999. Os hashes remotos coincidem com o inventário anterior, mas a coleta não devolve corpos para certificar por si só todos os detalhes da implementação local.

Não estão comprovados grants da sequência, uso atual nem capacidade remanescente. EXECUTE sozinho não comprova que um anônimo consiga avançá-la; com USAGE/UPDATE, há risco de consumo de códigos. O GRANT da 002 baseado em dependências de defaults também não comprova cobertura de sequência referenciada apenas dentro de PL/pgSQL. Propor coleta **somente de metadados/agregados**, sem chamar os geradores ou `nextval`, e revisar concessões mínimas antes de aprovar escrita. Completar nessa coleta a PK de `auth.users`, direitos DDL/ownership e direitos de gestão das policies Storage.

Não revogar cegamente EXECUTE/USAGE de usuários autenticados: inserts legítimos dependem desses defaults. Qualquer correção adicional de SQL deverá ser apresentada separadamente, com base nas evidências.

## 5. Atomicidade e recuperação sem backup

Cada candidata tem BEGIN/COMMIT próprios. Antes do COMMIT, uma falha deve desfazer o DDL/DML daquele arquivo; terminar a transação abortada com ROLLBACK e analisar a causa. **O conjunto de seis não é uma transação única**: falha na 005 não desfaz 001–004 já confirmadas. Guardas e timeouts não eliminam indisponibilidade ou contenção de locks.

Mudanças de publicidade/buckets feitas pelo painel/API, criação de usuários Auth, uploads, caches e publicação são operações separadas, sem rollback pela transação da migration. Consumo de sequência por `nextval`/`setval` também não é recuperado por rollback; não usar essas funções como teste de leitura. [PostgreSQL 17: sequências e transações](https://www.postgresql.org/docs/17/functions-sequence.html).

Depois de COMMIT, não existe rollback automático preparado do pacote. Correção deverá ser incremental e revisada, preservando registros criados. A referência estrutural não restaura dados perdidos nem bytes Storage. Não apagar schema/tabelas novas com histórico, não retornar documentos ao modo público e não reconstruir migrations de banco vazio como recuperação.

A dispensa de backup/laboratório e a suspensão de instalações permanecem respeitadas. O risco aceito de perda histórica não aprova exclusões indiscriminadas, exposição documental ou alteração remota. Sem backup restaurado, falhas com perda real podem exigir recadastro e não há garantia de reconstrução de assinaturas, documentos ou autoria. Os JSONs de auditoria **não são backup**.

## 6. Dependências para uma futura revisão de implantação

Esta seção registra dependências, não um roteiro autorizado de execução:

- 001 exige fingerprint anterior a mudanças de buckets; 002 depende do marcador da 001 e da correção C1.
- `portaria-evidence` deve existir privado e corretamente limitado antes de 003.
- Os quatro buckets legados devem estar privados antes de 004; preservar objetos, paths e metadados, sem DML direto em `storage`.
- `portaria-parcels` deve existir privado e limitado antes de 005; 006 depende da estrutura exata da 005.
- O primeiro perfil administrador e os perfis de porteiro dependem de usuários Auth reais autorizados e da tabela de perfis; não podem ser concedidos por signup público ou pelo próprio usuário. No fluxo conservador, bootstrap/ativação acontece após concluir contrato 4, antes da validação final de perfis no `02_postflight_readonly.sql` e da liberação do frontend. O `06_refinements_postflight_readonly.sql` confere o contrato físico/Storage; seu sucesso isolado não comprova um administrador ativo.
- Liberação do frontend exige marcador/manifesto/contrato 4 coincidentes, autenticação/perfis aprovados, testes negativos de RLS e testes positivos de Storage privado. Nenhum teste de leitura atual comprova esses comportamentos HTTP.

As correções C1/C2 foram concluídas somente no computador. **A execução continua bloqueada** por C3, pré-requisitos remotos e aprovação específica do pacote SQL novo. Não executar os SQLs renderizados atuais, não habilitar escrita, não iniciar o frontend original nem publicar.

## 7. Hashes, manifests e arquivos afetados

| Artefato | SHA-256 atual |
|---|---|
| Template `002_authorization.sql` | `1c98d9d22f1e1042d24862582ad18e1be342c9a50d29df09e495b9f348333437` |
| Cópia preparada `002_authorization.sql` | `b0a450015541bae01d8111af535ef6760cffaff92ada5aab74aef38cdf0fe419` |
| Bundle de seis arquivos preparados | `d8c7369c7530b46a74b0ec79d22a356042ff1531928e0e069e3908b3c61edf8f` |

Template 002 anterior: `0d46f9df72c37e691aa641db5f53d3a2469bc92b2e99d9a5c2631ac4dc695bc9`. Cópia anterior: `d2c451887f958695282ee5da5c2915b34d9aefd14a3aefed312aab8b981f240c`. A alteração foi registrada, não tratada como equivalência de hashes.

Manifestos locais atualizados: `.cache/original-review/candidate-hashes.json`, `.cache/original-review/sql/sha256.json` e resultado `.cache/original-review/final-preflight/comparison.json`. O registro `.cache/original-review/002-local-correction.json` preserva hashes anteriores/atuais dos seis templates e seis cópias, prova de escopo e resultados locais. Não contém registros pessoais ou credenciais.

`scripts/review-original-hashes.ts` e `npm run original:prepare` foram usados somente para recalcular/renderizar arquivos locais. Todas as cópias continuam com `APROVACAO_PENDENTE`/`RECUPERACAO_PENDENTE`; status do manifesto: `blocked_pending_recovery_decision_and_specific_sql_approval`. A regeneração escreveu as cópias, mas apenas os bytes da 002 mudaram. SQL 07 e seu manifesto não foram regenerados.

Arquivos de implementação alterados: `supabase/original/incremental/002_authorization.sql`, `scripts/original-preflight-model.ts`, `tests/original-preflight.test.ts` e `tests/original-incremental.test.ts`. Justificativas: revogação de grants, comparação com evidência complementar e cobertura de regressão/preservação. Documentos atualizados: este relatório, `ORIGINAL_FINAL_READONLY_VALIDATION.md` e `OIL_CHECK_TECHNICAL_PLAN.md`. Nenhum arquivo funcional de interface ou migration 007 foi criado/alterado.

## 8. Próximos passos e checklist

1. Usar a [revisão C3 aprovada localmente](ORIGINAL_C3_READONLY_REVIEW.md) para eventual execução manual somente leitura e salvar `.secrets/original-c3.json`. Nenhuma coleta remota foi iniciada pelo agente; o resultado real e a análise das evidências ainda estão pendentes.
2. Reavaliar compatibilidade com essas evidências e revisar o pacote SQL/hashes novos; não reaproveitar aprovação de bytes antigos. Manter candidatos sem aprovação de execução remota.
3. Só depois apresentar operações de painel/SQL delimitadas para nova autorização específica e conferência do baseline na janela futura.
4. O [plano de óleo](OIL_CHECK_TECHNICAL_PLAN.md) registra as decisões aprovadas: identificação válida obrigatória, tentativa frustrada não reinicia o contador de medição efetiva e exibição distinta da última tentativa/medição válida. Implementação e 007 permanecem fora desta etapa.

- [x] JSON completo, revisão, capacidades e cobertura RLS avaliados localmente.
- [x] Estruturas, grants, Auth/Storage, 14 checks e agregados comparados.
- [x] Falso alerta de funções corrigido usando a auditoria complementar anterior; drift real continua detectável.
- [x] Dez digests atuais validados; ausência de baseline anterior explicitada.
- [x] 002 e sua cópia corrigidas; hashes atualizados com valores anteriores preservados no registro local.
- [x] Outras cinco migrations e cópias idênticas por hash; cinco JSONs de auditoria, destino, SQL 07 e manifesto inalterados.
- [x] Privilégios de `drivers`, rollback e preservação de 95 registros fictícios validados em memória.
- [x] 77 testes locais passaram, incluindo 22 do comparador e postflights sintéticos de 005/006; zero falhas ou skips.
- [x] Lint e TypeScript completos passaram.
- [x] Comparação dos inventários locais retornou match de catálogo/agregados com revisão humana ainda necessária.
- [x] Decisões de óleo registradas, sem implementação ou 007.
- [x] SQL complementar C3 preparado separadamente, com testes e manifesto próprios; sem execução remota.
- [ ] Complementar sequências, constraints Auth, privilégios do instalador e configurações externas.
- [ ] Criar buckets, alterar privacidade e atribuir perfis **somente após aprovação remota específica**.
- [ ] Executar migrations/postflights/testes reais e publicar **somente após nova revisão e autorização**.
- [ ] Implementar/testar óleo e 007 somente em autorização futura própria.

Comandos executados: `npm run lint`, `npm run typecheck`, `node --no-warnings --experimental-strip-types --test tests/original-incremental.test.ts tests/logistics-database.test.ts tests/original-sources.test.ts tests/original-preflight.test.ts` e `npm run original:preflight-compare`. O primeiro ensaio isolado dos 22 testes do comparador também passou; ele não é contado novamente no total de 77.

Os testes SQL usam PGlite/PostgreSQL WASM em memória (motor disponível de versão principal 18), esquemas gerenciados simulados e dados fictícios. Confirmam sintaxe, regras e transação nesse laboratório; não comprovam permissões/HTTP do Supabase original PostgreSQL 17. Nenhuma migration foi aplicada em banco real. Não foram reexecutados build ou navegador porque a interface não mudou; não houve ensaio de restauração nem promessa de recuperação sem backup.
