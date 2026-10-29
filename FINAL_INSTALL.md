# Sistema Portaria — conclusão local e instalação autorizada

Atualizado em 28/10/2026. **Instalação remota executada manualmente pela usuária; nenhum SQL remoto ou publicação executado pelo agente.** Liberação local original `read-write`, contrato 5, conferida após comando interativo confirmado pela usuária. A URL http://127.0.0.1:5173/ passa a conectar ao original quando iniciada com `npm run dev:original`; `npm run dev` continua sendo demonstrativo. Publicação não autorizada.

**Estado atual:** instalação, perfis e postflights preservados. A usuária identificou e removeu a concatenação anon + sb_publishable_ em .env.original.local. Conferido localmente: somente JWT anon HS256, formato completo, projeto correspondente e não expirado. Atualizado exclusivamente publicKeySha256 em original.target.local.json; destino, acesso read-write e release contrato 5 mantidos. Registro em .cache/original-review/authorization/public-key-correction.json; nenhum valor de chave divulgado. A correção passou na validação local, mas ainda não foi testada remotamente. **Próxima operação:** na janela de terminal da instância Vite original que ocupa a porta 5173 (PID 26576 confirmado no diagnóstico), pressionar Ctrl+C e reiniciar com **npm run dev:original**. Não iniciar uma segunda instância nem alterar a porta fixada. Confirmar o reinício para repetir a leitura do marcador antes de novo teste de login. Nenhuma alteração de dados, Auth, Storage ou RLS; sem build/deploy. Netlify permanece não autorizado e deploymentApproved=false.

## Pronto

- Óleo inline no OK: nível obrigatório, notas opcionais, última medição válida, dias em São Paulo, última tentativa distinta, histórico paginado e exportação. Baixo/Crítico destacados; disponibilidade inalterada.
- Conferência e óleo na mesma transação, autoria do perfil autenticado, tentativa idempotente e vínculos validados. NOK dispensa óleo. Sem histórico: “Sem verificação anterior”. Tentativa frustrada permanece no histórico e não reinicia o contador.
- Migration 007 independente/contrato 5, sem backfill. Guarda diferida impede novo OK sem óleo, inclusive por caminho antigo; RPCs antigas revogadas para os papéis do app. Achado sem cadastro permanece pendente de identificação, sem óleo/associação automática por placa.
- C3 e complemento Storage recebidos e analisados localmente: chave Auth elegível, direitos públicos disponíveis, policies gerenciadas permitidas em objects/buckets, RLS habilitada e papéis do app sem login SQL. Usuário confirmou `storage` ausente de Exposed schemas.
- 002 fecha `drivers` e corrige acesso anônimo aos geradores/sequências; perfis inativos não consomem códigos. Mantém formato, limites e valores atuais, sem nextval/setval na instalação.
- 004 usa RLS/restrições de buckets no caminho Supabase gerenciado; não altera owner ou assume papéis reservados. Grants do provedor não são tratados como revogáveis por postgres. [Comportamento documentado pelo Supabase](https://supabase.com/kb/troubleshooting/revoking-privileges-on-storage-pg_cron-vault-and-extension-objects-has-no-effect).

## Pacote exato para revisão

Arquivos locais em **`.cache/original-review/sql/001_foundation.sql` até `007_oil_checks.sql`**, com hashes em **`.cache/original-review/sql/sha256.json`**. SHA-256 do bundle de revisão:

`52e8524cb426e71eea41bdf0c4cb5eaf17c4c8bda110c0c15c434e4337f11c6d`

O pacote de revisão acima foi arquivado em `.cache/original-review/authorization/review-before-approval/`. A aprovação foi registrada, e somente os vínculos literais de aprovação/dispensa foram preenchidos nas cópias executáveis; os sete templates permanecem iguais aos aprovados. O manifesto corrente é `.cache/original-review/sql/sha256.json`, com histórico em `.cache/original-review/authorization/executable-release.json`.

SHA-256 do bundle executável autorizado: `9b9fe77f1c6419dff9556ef401442e128ce44acf40c2fab30e175d4067dc7829`.

SHA-256 da primeira operação, `001_foundation.sql`: `bf360d76905590eb2eace980d872f16acb6baad3acacb88ec7f680ac427a09ef`.

001, 003, 005 e 006 foram preservadas; os ajustes de 002/004 e a nova 007 integram o pacote aprovado. Não usar o pacote DEV/banco vazio nem `original:preflight-prepare`.

## Autorização consolidada necessária

A aprovação deve delimitar o pacote 001–007 vigente, projeto original configurado, execução manual pelo SQL Editor, operações de Storage abaixo, contas Auth escolhidas para admin/porteiro, atribuição dos perfis e testes conectados **com dados fictícios**. Manter a dispensa de backup já decidida explicitamente registrada para os sete hashes atuais; isso não autoriza apagar históricos/documentos. A aprovação não inclui publicação, commit, push ou merge.

Procedimento após essa autorização, sem repetir auditorias completas:

1. Registrar somente a aprovação SQL e a dispensa no mecanismo privado existente. Manter `remoteMigrationsApplied`, `postflightValidated`, `frontendOperationsApproved` e `deploymentApproved` falsos até suas respectivas evidências/autorização. Executar `npm run original:prepare` para renderizar o pacote aprovado e conferir os hashes finais.
2. No projeto correto, aplicar **001 → 002**. A 001 verifica o fingerprint original **antes** de mudar/criar buckets. Parar em qualquer erro, aviso de privilégio inesperado ou diferença estrutural; não avançar no pacote.
3. Pelo painel Storage, preservar os quatro buckets/objetos/caminhos existentes e torná-los privados: `access-documents`, `driver-cnh-documents`, `person-documents`, `vehicle-operation-photos`. Criar privados `portaria-evidence` e `portaria-parcels`, ambos com limite de 10 MiB e MIME JPEG/PNG/WebP. Não mover/excluir arquivos ou alterar owners. Não adicionar storage/Auth/portaria aos schemas expostos da Data API.
4. Aplicar **003 → 004 → 005**, executar `supabase/original/05_logistics_postflight_readonly.sql` no contrato 3; aplicar **006**, executar `06_refinements_postflight_readonly.sql` no contrato 4; aplicar **007** e executar `09_oil_postflight_readonly.sql` no contrato 5.
5. Conferir preservação por `01_integrity_readonly.sql`, `03_documents_patio_readonly.sql` e `04_preservation_readonly.sql`, comparando ao JSON 07 já salvo antes de testes que criem registros. Não reconciliar automaticamente os 17 veículos, as 65 URLs ou owners legados. Igualdade de contagens não substitui os digests disponíveis.
6. Usar contas Auth existentes autorizadas, ou criar apenas as contas aprovadas pelo painel, sem enviar senhas/UUIDs ao chat. Preparar cópia privada de `supabase/original/manual/profile_assignment.example.sql`, preencher as duas contas e vínculos de aprovação/recuperação; atribuir perfis somente após o contrato 5. Não sobrescrever perfil existente automaticamente. Conferir signup fechado ao público e URLs locais/site aprovado, sem mudar providers/MFA fora da autorização.
7. Executar `02_postflight_readonly.sql` e `09_oil_postflight_readonly.sql`: pelo menos um admin ativo; seis buckets privados; contrato 5; zero óleo sem vínculo/OK sem óleo/RPC antiga liberada. Registrar evidências de aplicação/postflight, sem declarar sucesso antes da execução manual.
8. Com aprovação das operações reais do frontend registrada, executar **`npm run original:authorize-write`**, depois **`npm run dev:original`**. Isso passa a permitir login e operações reais. Validar admin/porteiro e fluxos com entidades/arquivos fictícios; não usar históricos reais como teste de edição/devolução.

Não há executor SQL administrativo remoto configurado neste checkout; a chave pública do frontend não substitui SQL Editor. Execução pelo usuário deve ser confirmada pelos resultados, nunca presumida.

**Aviso do SQL Editor na 005:** selecionar **Run without RLS** para executar o SQL aprovado sem acréscimos automáticos. Isso não desativa a RLS: a própria migration a habilita por SQL dinâmico nas cinco tabelas novas e revoga todos os privilégios diretos de PUBLIC/anon/authenticated. Essas tabelas privadas não recebem policies de acesso direto; o aplicativo usa RPCs SECURITY DEFINER com validação de perfil ativo e EXECUTE restrito. As seis policies novas estão em storage.objects para o bucket de encomendas. A opção Run and enable RLS reescreve o SQL, adicionando comandos; não usar para este pacote. A 005 permanece pendente até confirmação explícita de execução sem erros, seguida do postflight 05.

## Netlify — autorização posterior específica

**Atualização para CI após a transferência GitHub:** o procedimento vigente está em [NETLIFY_AUTODEPLOY.md](NETLIFY_AUTODEPLOY.md). Origin atualizado para o repositório de brunagarciagontijo-maker, consulta remota confirmou main; configuração automática preparada para production/main com destino e contrato pinados, sem arquivos privados. Staging autorizado, mas commit/push/merge/deploy ainda não executados. As instruções de upload manual abaixo documentam a estratégia anterior; não utilizar os artefatos intermediários de .cache como release final.

Após validação conectada, definir a URL HTTPS final e alinhar `VITE_PUBLIC_APP_URL` e `appOrigin` do destino local ignorado, preservando URL/chave pública pinadas. Preparar **`npm run build:original`** após a liberação válida do contrato 5. O build demonstrativo atual não é o artefato de produção.

Publicar somente após aprovação específica. O caminho automático atual exige production/main e contrato público validado; desenvolvimento/previews são bloqueados. Não fazer push para provocar deploy antes de conferir as configurações externas e autorizações. Não publicar enquanto domínio, configuração Auth e pacote compilado original não estiverem conferidos.

## Resultados e limites

- Suíte completa: **214 testes aprovados**. Depois, dois casos adicionais de paginação/autoria foram adicionados e passaram com a suíte SQL de óleo de **19 casos** (não somar 19 novamente aos 214).
- Navegador: **52 testes aprovados**, desktop/celular, incluindo regressão visual, Auth simulado, assinaturas, câmera, documentos, veículos/pessoas, encomendas, pátio, óleo, histórico, gestão e timeline. Requisições externas bloqueadas nos cenários.
- Lint/TypeScript aprovados; build demonstrativo atualizado após a última correção de atualização do histórico também passou. Prévia local HTTP 200 e modo demo confirmados em http://127.0.0.1:5173/.
- SQL testado em PostgreSQL WASM 18 com dados fictícios; original é PostgreSQL 17/Supabase gerenciado. Policies/sessões/URLs assinadas ainda precisam de validação conectada autorizada. Cache/concorrência não permitem transformar os 835 valores não reservados observados na sequência móvel em garantia de capacidade exata.
- Cada migration é uma transação separada: falha posterior não desfaz anteriores já confirmadas. Operações de painel/Auth/Storage são separadas. Sem backup, perda real pode não ser recuperável; não usar DELETE/CASCADE/recriação/retorno a documentos públicos como rollback. Em erro, interromper e preparar correção incremental preservando o estado alcançado.

**Pendente:** realizar login admin, login/permissões do porteiro e testes conectados dos fluxos com entidades/arquivos fictícios, uma operação manual por vez. Liberação interativa local concluída, sem comprovação ainda de login real, URLs assinadas, permissões por sessão ou funcionamento dos fluxos conectados. Nenhuma migration foi executada pelo agente. Publicação Netlify continua não autorizada e deploymentApproved=false; não executar build/publicação nesta etapa de testes locais.
