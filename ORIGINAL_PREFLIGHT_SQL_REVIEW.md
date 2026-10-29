# Revisão do SQL 07 — 28/10/2026

**Pronto para execução manual do arquivo completo, com pré-condições que abortam por segurança.** Revisão limitada ao SQL de preflight, manifesto de hashes e documentação. Não houve consulta ao Supabase, alteração de perfil, aplicação de migration, acesso a arquivos Storage ou modificação dos JSONs de auditoria existentes.

Arquivo: [07_final_preflight_readonly.sql](.cache/original-review/final-preflight/07_final_preflight_readonly.sql). Hash vigente e revisão 2: [manifest.json](.cache/original-review/final-preflight/manifest.json). Os cinco SQLs-base e os seis candidatos incrementais continuam inalterados.

## Compatibilidade e permissões

| Recurso | Confirmação técnica | Condição verificada na execução manual |
|---|---|---|
| `pg_catalog.query_to_xml(text, boolean, boolean, text)` | Documentado no PostgreSQL 17; executa o SELECT textual fornecido e devolve XML | EXECUTE na função, suporte XML/libxml no servidor e permissão para o SELECT interno. O primeiro teste usa somente `SELECT 1`; o único acesso dinâmico a dados é `SELECT version` do ledger |
| `pg_catalog.sha256(bytea)` | Função nativa documentada no PostgreSQL 17, sem necessidade de instalar `pgcrypto`; retorno `bytea` convertido em hexadecimal por `encode` | EXECUTE na função e nas funções auxiliares; o primeiro teste compara o hash UTF-8 de `abc` ao vetor conhecido |
| `pg_catalog.row_security_active(oid)` | Consulta nativa da situação efetiva de RLS para a relação e o papel atual | Não substituída por inferência baseada apenas em SELECT, propriedade ou nomes de papéis |
| Relações auditadas | Dez tabelas públicas e duas relações Storage, conforme contrato recebido | USAGE nos schemas, SELECT nas tabelas e RLS efetivamente inaplicável ao papel atual. Ledger, quando presente, tem verificação equivalente |

Referências oficiais do PostgreSQL 17: [XML](https://www.postgresql.org/docs/17/functions-xml.html), [SHA-256/binários](https://www.postgresql.org/docs/17/functions-binarystring.html), [funções de privilégios e RLS](https://www.postgresql.org/docs/17/functions-info.html), [privilégios](https://www.postgresql.org/docs/17/ddl-priv.html).

**Não foram consultados os grants atuais do original.** O PostgreSQL 17 é o alvo dos inventários anteriores; a documentação confirma as assinaturas usadas. A disponibilidade e as permissões atuais serão testadas pelo próprio arquivo antes da auditoria dos dados. O acesso completo ao painel não deve ser tratado como prova desses privilégios no papel efetivo do SQL Editor. Falha de permissão deve interromper a execução, sem GRANT, mudança de owner, uso de service_role ou ajuste remoto automático.

## Correções de cobertura RLS

O preflight anterior calculava cobertura, mas não impedia a obtenção de contagens sob RLS. A revisão acrescenta `SET LOCAL row_security=off` dentro da transação somente leitura: **isso não desativa RLS nas tabelas, não concede BYPASSRLS e não remove policies**. O PostgreSQL gera erro se uma consulta depender da aplicação de RLS. O ajuste termina com a transação. [Comportamento documentado](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Antes da leitura de tabelas de aplicação, uma guarda de catálogo exige doze tabelas físicas compatíveis, schemas acessíveis, SELECT e `row_security_active=false`. Ela recusa views, foreign tables, herança/particionamento e tipos ou colunas virtuais fora do contrato. Para as dez tabelas públicas que entram nos digests, examina todos os tipos de colunas; em Storage, somente os campos efetivamente lidos. Não exige que colunas Storage adicionais e não usadas sejam tipos nativos.

`source_visibility` mantém os quatro campos já consumidos pelo comparador e acrescenta diagnósticos de acesso ao schema e RLS ativo. `unfiltered_relations` exige simultaneamente SELECT, USAGE e resultado nativo de RLS inativo. Uma policy que permita SELECT de todas as linhas continua sendo RLS ativo: o preflight recusa usar isso como comprovação geral de leitura integral. Proprietário sem FORCE RLS e papel já autorizado com BYPASSRLS são tratados conforme o motor, sem conceder novos privilégios.

O ledger pode estar ausente, preservando a lógica anterior de inventário vazio com sinalização de ausência. Quando existe, a guarda exige tabela física, sem herança, coluna `version` textual armazenada e permissões/RLS adequados. Uma view no lugar do ledger é rejeitada antes do `query_to_xml`.

## Funções, tipos e efeitos colaterais

- Chamadas nativas e catálogos foram qualificados com `pg_catalog`; o `search_path` local é fixado em `pg_catalog, public, extensions`. Nenhuma RPC/função de aplicação é chamada diretamente. COALESCE, NULLIF e XMLTABLE são construções SQL, não funções de aplicação.
- O SQL textual de `query_to_xml` é constante: apenas o probe `SELECT 1` e o SELECT de versões. Não contém escrita, SQL fornecido por usuário, concatenação de identificadores, chamada de integração ou corpo das migrations.
- RLS dependente de funções da aplicação é rejeitado antes da auditoria. Guards também impedem leitura por views/foreign tables e serialização de tipos de aplicação que poderiam disparar callbacks inesperados. Triggers e funções são inventariados por metadados/hashes; seus corpos não são executados.
- São lidos somente metadados do Storage e referências para agregação: não há API/S3, HTTP, download, `pg_read_file`, large-object export ou abertura de documento. Pessoas/veículos são processados internamente apenas para contagens e digests; não são devolvidos registros pessoais.
- A ordem das tabelas, junções, regras dos checks e campos originais dos digests foi mantida. A nova qualificação foi comparada com os cinco SQLs-base sobre registros fictícios e preservou seus resultados. Search path explícito pode afetar representação de metadados em ambientes com contexto anterior diferente; eventual diferença de hash exige revisão de qualificação/contexto, sem presumir DDL real nem descartá-la automaticamente.

Condições estruturais devem permanecer estáveis durante a coleta. A auditoria não autoriza alterações concorrentes nem garante que o estado continuará igual até a implantação.

## Testes locais realizados

Foram concluídas **20 verificações com execução integral do SQL em PostgreSQL WASM, somente em memória e com dados/esquema fictícios**, sem executar os candidatos de migration ou conectar a qualquer serviço. DDL/DML de montagem e permissões existiram apenas dentro dessas fixtures descartáveis; nenhum banco real foi alterado.

- Execução completa, ledger ausente e ledger presente; aliases, tipos e subconsultas resolvidos no cenário sintético.
- Igualdade dos cinco resultados anteriores: inventário, contrato gerenciado, integridade, diagnóstico documental e digests.
- Ausência das sentinelas de conteúdo pessoal nos resultados agregados.
- Rejeição de SELECT sujeito a RLS, inclusive policy `USING(true)`; proprietário sem FORCE aceito, proprietário com FORCE rejeitado e papel existente BYPASSRLS aceito.
- Rejeição de SELECT ou USAGE ausente antes da leitura dos dados.
- Funções sentinela em policies, view do ledger e funções públicas homônimas de `sha256`/`to_jsonb` não foram chamadas.
- EXECUTE ausente para XML e SHA-256 foi rejeitado com `42501`.

**Limitação explícita:** o motor WASM disponível é PostgreSQL **18**, não o PostgreSQL 17 original. Compatibilidade de recursos com 17 foi conferida em documentação oficial e no contrato de tipos recebido; não houve teste runtime num servidor 17 nesta revisão. Não foi instalado outro motor, Docker/WSL ou ferramenta. A execução manual no original continua necessária para confirmar o ambiente real.

## Como executar e tratar falhas

1. Conferir o projeto original no painel e abrir a revisão 2 pelo link acima.
2. Executar **o arquivo inteiro**, sem selecionar somente o último SELECT. Ele inicia `REPEATABLE READ READ ONLY`, aplica somente ajustes locais da sessão, executa duas guardas e termina com `ROLLBACK`.
3. As guardas `native_function_guard` e `metadata_read_guard` devem retornar **1**. O último resultado é a coluna JSON `preflight`, agora com `preflight_revision=2`, capacidades nativas e contexto de leitura.
4. `22012` em uma guarda significa pré-condição não satisfeita; `42501` indica permissão insuficiente; `0A000` pode indicar recurso não suportado. Parar e informar apenas código/etapa, sem publicar dados ou alterar permissões. Não pular a guarda nem executar o restante isoladamente. Se a sessão ficar em transação abortada, encerrar com `ROLLBACK` antes de outra operação.
5. Guardar o JSON em `.secrets/original-final-preflight.json`, preservando qualquer resultado anterior antes de substituí-lo. Conferir `preflight_revision=2` e os diagnósticos: o comparador anterior foi preservado e não exige automaticamente esse campo adicional. Não reutilizar um resultado antigo como se viesse da revisão 2. Não publicar o conteúdo no chat. Nenhum JSON foi sobrescrito por esta revisão.

**Não reexecutar `npm run original:preflight-prepare` nesta etapa.** Por respeito ao escopo solicitado, o gerador e o comparador foram preservados; o gerador anterior sobrescreveria as correções diretas do arquivo 07. Utilizar o SQL revisado e seu hash atual. A sincronização do gerador é uma pendência local separada; não altera a prontidão deste arquivo para execução manual.

## Checklist atualizado

- [x] Assinaturas e requisitos de XML/SHA-256 conferidos para PostgreSQL 17.
- [x] Probes nativos e guardas de leitura integral anteriores à coleta adicionados.
- [x] SELECT separado de comprovação de RLS inativo; FORCE RLS e permissões negativas testados.
- [x] Catálogos/funções nativas qualificados; acesso a conteúdo Storage ausente.
- [x] Vinte verificações locais aprovadas e resultados dos cinco SQLs-base preservados no cenário fictício.
- [x] Hash do 07 atualizado; cinco SQLs-base, seis migrations, scripts e JSONs existentes preservados.
- [ ] Execução manual da revisão 2 no original e confirmação de suporte/permissões reais.
- [ ] Comparação do novo JSON com as auditorias anteriores; compatibilidade atual ainda não aprovada.
- [ ] Sincronizar futuramente o gerador com a revisão SQL, antes de permitir nova geração automática.

Nenhuma autorização de escrita, migration, alteração de Auth/Storage/RLS, commit, push, merge ou deploy foi concedida ou utilizada.
