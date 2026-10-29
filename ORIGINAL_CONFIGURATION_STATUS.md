# Configuração local do Supabase original — 28/10/2026

**Etapa seguinte de leitura:** [validação final e pacote manual](ORIGINAL_FINAL_READONLY_VALIDATION.md). O SDK continua bloqueado em metadata-only; não houve consulta programática. Foi preparado SQL de leitura consistente para o usuário executar no SQL Editor. Compatibilidade remota atual depende do novo JSON; nenhum perfil foi liberado.

## Revisão de segurança confirmada

Branch `desenvolvimento`. `npm run original:configure` chama somente `node --experimental-strip-types scripts/configure-original.ts`; não existem hooks `preoriginal:configure` ou `postoriginal:configure`. O script importa APIs locais de processo, terminal, filesystem e criptografia, além do validador de ambiente e constantes locais. Nenhum cliente SQL/Supabase é importado pelo configurador. Não há fetch, login, refresh, consulta remota, migration, upload, instalação ou publicação nessa operação.

O procedimento exige terminal interativo e recusa entrada por argumentos ou pipe. A chave é recebida com eco suprimido e validada como anon/publishable; chaves administrativas são recusadas. O script grava somente `.env.original.local` e `original.target.local.json`, ambos ignorados pelo Git. A chave pública não é uma senha de banco; nenhum secret/service_role ou connection string deve ser fornecido.

O perfil configurado pelo script é `environment=original`, `access=metadata-only`, `authorization=ORIGINAL SOMENTE LEITURA`, sem `release`. `remoteEnabled=true` identifica a configuração explicitamente selecionada; não libera o SDK. `getSupabase()` rejeita metadata-only antes de criar cliente; `src/main.tsx` mostra somente a tela de inventário, sem montar AuthProvider/App nesse perfil. `npm run dev` continua demo. A configuração não inicia/reinicia servidor nem troca um processo em execução.

Validação desta revisão: **34 testes locais aprovados**, incluindo recusa de chaves administrativas, pinagem de destino/chave/origem, ausência de conexão na importação, bloqueio SDK metadata-only e dispensa de backup sem liberação automática de escrita. Não houve migrations, consultas remotas ou login nesses testes.

## Estado da execução

- [x] Script, dependências transitivas e scripts npm revisados.
- [x] Procedimento interativo iniciado numa janela PowerShell local, com permissão pontual para abertura da janela.
- [x] Usuário concluiu entrada oculta dos parâmetros e confirmou sucesso; nenhum valor foi enviado ao chat ou capturado nos relatórios.
- [x] Arquivos gerados e ignorados pelo Git conferidos sem imprimir valores: perfil original, metadata-only, sem release; chave/origem válidas e referência compatível com a impressão digital original conhecida localmente.
- [x] SDK testado com a configuração efetiva e rede bloqueada para a própria checagem: recusou criação do cliente; **zero chamadas fetch**. Validação sintática/pinagem não comprova validade da chave no serviço remoto; isso não foi consultado.
- [x] `npm run original:prepare` executado; seis SQLs e manifesto gerados. Conferidos hashes de cada arquivo, pacote, inventário e templates atuais, identificação do destino, transações e ausência de `REPLACE_*` residual.

**Estado confirmado em 28/10/2026:** configuração concluída; somente perfil local original metadata-only preparado. O comando padrão `npm run dev` permanece demo; nenhum servidor foi iniciado/reiniciado. Não existem recibo real de aprovação ou documento privado de dispensa nesta etapa. Auth, Storage, Realtime, queries remotas e escrita continuam bloqueados. Nenhuma conexão foi liberada.

Os SQLs estão em `.cache/original-review/sql/`; o manifesto `sha256.json` tem status `blocked_pending_recovery_decision_and_specific_sql_approval`. Os seis arquivos têm guardas `APROVACAO_PENDENTE` e `RECUPERACAO_PENDENTE`. A geração não alterou os templates, as migrations históricas ou o Supabase. Hashes conferidos são dos arquivos de revisão; uma renderização autorizada posterior muda essas guardas e exige nova conferência dos hashes finais.

### Checklist das etapas futuras

- [ ] Aprovação específica para consultas remotas atuais e baseline da janela.
- [ ] Registrar documento privado de dispensa já expressa pelo usuário, vinculado a projeto/inventário/templates; manter backup/restauração como não realizados.
- [ ] Aprovar conteúdo SQL, renderizar versão executável e aprovar/conferir seus hashes finais; não preencher recibos de aplicação/postflight antecipadamente.
- [ ] Aprovar janela, SQLs, buckets e perfis; executar somente então as operações remotas delimitadas.
- [ ] Validar preservação e serviços reais; autorizar operações controladas do frontend e, posteriormente, publicação.

## Preparação local dos SQLs

Depois de confirmar a configuração metadata-only, executar somente:

```powershell
npm run original:prepare
```

O script usa inventário local e templates, cria `.cache/original-review/sql/001_foundation.sql` até `006_physical_checks_timeline.sql` e `sha256.json`, sem conectar ao banco. Os seis hashes dos arquivos, o hash do pacote, o fingerprint do inventário e os hashes dos templates permitem conferir integridade local.

**Revisão não equivale a aprovação:** sem recibo específico de SQL e documento de recuperação/dispensa válidos, os arquivos gerados permanecem com guardas `APROVACAO_PENDENTE`/`RECUPERACAO_PENDENTE` e status bloqueado. São cópias para revisão, não comandos liberados. Não preencher `sqlApproved`, `remoteMigrationsApplied`, `postflightValidated`, `frontendOperationsApproved` ou `deploymentApproved` para contornar essa etapa. Não emitir comprovante de backup: o usuário dispensou backup/laboratório.

O pacote executável definitivo exigirá aprovação específica e nova renderização/conferência dos hashes finais. Nenhum template `REPLACE_*`, pacote `supabase/dev`, `supabase/database.sql` ou replay das 21 migrations será executado no original.

## Ordem remota futura — não autorizada nesta etapa

1. Conferir projeto/estado atual e baseline somente leitura, após autorização: `00_inventory_readonly.sql` e `00b_managed_contract_readonly.sql` se houver mudança, mais `01_integrity_readonly.sql`, `03_documents_patio_readonly.sql` e `04_preservation_readonly.sql`. Confirmar se `portaria` já existe. Nenhum arquivo desses foi executado nesta revisão.
2. Em janela sem operações concorrentes, aplicar **001**, depois **002**, cada arquivo/transação com hash exato aprovado. O fingerprint de 001 é verificado antes de mudar buckets.
3. Pelo painel/API Storage em operação aprovada separadamente: conferir/tornar privados `access-documents`, `driver-cnh-documents`, `person-documents` e `vehicle-operation-photos`; criar/conferir privados `portaria-evidence` e `portaria-parcels`, limite 10 MiB, MIME JPEG/PNG/WebP. Preservar configurações legadas compatíveis, inclusive PDFs onde existentes. Não alterar linhas de buckets por SQL, apagar objetos ou reabrir publicidade.
4. Aplicar **003 → 004 → 005**, executar `05_logistics_postflight_readonly.sql` no estágio contrato 3, depois aplicar **006**. Sem erro/timeout/estado inesperado antes de avançar. Dois buckets novos podem ser preparados na mesma operação de painel; precisam existir privados antes dos lotes que dependem deles.
5. Com contrato 4, atribuir perfis às contas Auth existentes e aprovadas usando cópia privada de `manual/profile_assignment.example.sql`. O modelo exige duas contas distintas e não sobrescreve perfis. Se houver apenas uma conta/perfis existentes, revisar a operação pontual. Criar usuários ou mudar Auth exige aprovação própria; nenhum UUID ou senha deve ser enviado ao chat.
6. Executar `02_postflight_readonly.sql` e `06_refinements_postflight_readonly.sql`; repetir 01/03/04 antes de testes que gravem registros. Exigir pelo menos um admin ativo, seis buckets privados, marcador contrato 4 coerente e ausência de inconsistências inesperadas. Preservar os 17 estados de revisão e as 65 URLs, sem correção automática.
7. Somente após aprovação de operações reais, liberar frontend local, testar com novos dados fictícios e autorizar publicação em etapa própria. Login/refresh/Auth, upload e RPC são operações reais. Postflight agregado não comprova sozinho JWT/RLS/Storage HTTP.

Aplicação de SQL será manual no SQL Editor, pelo conteúdo dos seis arquivos finais aprovados. **Não há comando npm que aplique essas migrations.** Não usar `psql`, Supabase CLI, `db push`, `db reset` ou instaladores como substituição neste computador.

## Comandos posteriores e autorização necessária

| Comando/operação | Efeito | Condição |
|---|---|---|
| `npm run original:prepare` | Somente renderização local | Já autorizado nesta etapa, após configurar destino; não executa SQL |
| Executar conteúdo de `001_foundation.sql` → `006_physical_checks_timeline.sql` no SQL Editor, na ordem acima | DDL, policies, funções, triggers e marcador remotos | Aprovar explicitamente arquivos/hashes finais, projeto, janela e estratégia de dispensa; nunca executar cópias bloqueadas |
| Executar os SQLs somente leitura de baseline/postflight | Consulta remota | Autorização de leitura remota específica, ausente nesta etapa |
| Alterar/criar buckets e atribuir perfis/contas pelo painel/API/modelo privado | Alteração remota de segurança/configuração/dados administrativos | Aprovação do escopo exato; fora das transações das seis migrations |
| `npm run original:authorize-write` | Grava liberação local que permitirá Auth e operações reais quando o app abrir | Aprovação específica das operações do frontend, SQL aplicado e postflight validado; não executar agora |
| `npm run dev:original` após liberação | Inicia frontend apto a acessar o original | Aprovação de testes operacionais reais; metadata-only continua bloqueado, mas servidor não será iniciado nesta etapa |
| `npm run build:original` | Compila artefato original local com configuração liberada | Etapa futura após liberações; não publica sozinho |
| Publicar artefato / mudar GitHub ou Netlify | Exposição do sistema / possível automação | Aprovação específica de deploy, domínio HTTPS e configuração Auth/headers/CI. Bloqueio Netlify atual permanece |

`npm run original:lock` bloqueia novamente a configuração local (exige reinício/fechar abas), mas não revoga JWTs, não interrompe outras estações e não desfaz SQL remoto. Rollback SQL vale apenas antes do COMMIT do lote; sem backup, perda após COMMIT pode exigir reconstrução manual ou ser irrecuperável. Ver [plano consolidado](ORIGINAL_SIMPLIFIED_DEPLOY.md).

Nenhum valor de projeto, chave, token, connection string, UUID pessoal, documento ou URL assinada é necessário neste relatório. Os arquivos privados e os SQLs renderizados ficam ignorados pelo Git; isso não equivale a criptografia ou ausência de sincronização do diretório corporativo.
