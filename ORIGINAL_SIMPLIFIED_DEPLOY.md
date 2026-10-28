# Integração original — implantação simplificada sem backup

**Validação final de leitura:** [estado e próximo passo manual](ORIGINAL_FINAL_READONLY_VALIDATION.md). O perfil metadata-only permanece bloqueado, sem contorno; novo pacote de leitura está preparado e aguarda execução manual. Não há confirmação do estado remoto atual nem aprovação de migrations. Não foi encontrado baseline anterior de digests 04.

**Atualização de 28/10/2026:** configuração local original concluída, metadata-only e SDK bloqueado; seis cópias SQL renderizadas para revisão com hashes conferidos e guardas mantidas. Sem recibo ativo, consulta remota ou execução SQL. Ver [checklist e comandos posteriores](ORIGINAL_CONFIGURATION_STATUS.md).

Decisão vigente do usuário, 27/10/2026: **dispensar backup completo e laboratório de restauração**, aceitando expressamente o risco de perder registros históricos. O plano de instalar WSL, Docker, PostgreSQL CLI e ferramentas exclusivas de backup está suspenso. As pastas vazias já preparadas e os materiais anteriores ficam preservados como referência; nenhum serviço será instalado/iniciado por este roteiro.

Esta decisão permite preparar uma alternativa aos bloqueios de backup. **Não aprova SQL remoto, alteração de Storage/Auth/RLS, exclusão de dados ou publicação.** Não preencher comprovantes de restauração/backup como verdadeiros. Esta entrega altera somente código, testes, SQL candidato e documentação locais; nenhum destino/credencial/recibo privado de escrita foi liberado.

## Confirmado e pendente

Confirmado pelos inventários locais fornecidos e comparação repetida localmente:

- PostgreSQL 17; dez tabelas públicas; RLS habilitada no escopo recebido, mas 41 policies amplas. RLS habilitada não prova isolamento efetivo.
- Seis campos de autoria ausentes, 39 diferenças de nullability, nenhuma diferença de tipo e oito diferenças de default. Os candidatos adicionam os seis campos e relaxam apenas `operational_movements.driver_cnh_valid_until`; não preenchem autoria passada, não alinham todos os defaults ou tornam colunas obrigatórias em massa.
- Ledger com 21 migrations e uma divergência de versão; preservar sem repair/replay. Os seis candidatos são complementares, não substituem o histórico.
- Baseline recebido: 185 registros legados, 144 movimentos e 90 acessos; duplicidades/conflitos/órfãos/placas com zero problemas nas verificações executadas pelo usuário. Repetir baseline na janela futura, antes de testes que gravem dados.
- 17 veículos fora sem saída aberta: manter estados e sinalizar revisão. 65 URLs documentais têm correspondência única com objetos no inventário, sem autorização para reescrever campos ou presumir publicidade de todas.
- Quatro buckets e 236 objetos catalogados, aproximadamente 360 MiB informados. Dois buckets foram auditados como públicos: `driver-cnh-documents` e `vehicle-operation-photos`. Não houve download/conferência dos bytes ou nova consulta remota nesta revisão.

Pendente: estado remoto atual, possíveis candidatos já aplicados fora desta sessão, permissões efetivas do executor, usuários Auth disponíveis, configuração Data API/exposed schemas, comportamento real de JWT/Storage/Realtime, MIME/limites dos legados, acesso móvel por HTTPS, domínio final e GitHub/Netlify. O inventário é fotografia, não verificação ao vivo.

## Auditoria das seis migrations

Todos os candidatos usam `BEGIN`/`COMMIT`, timeouts de bloqueio/execução e guardas de projeto, revisão de recuperação e estágio. **Não há `DROP TABLE`, `DROP SCHEMA`, `DROP COLUMN`, `TRUNCATE` executável nem `DELETE FROM` nos seis arquivos.** `REVOKE TRUNCATE` retira um privilégio; não trunca dados. Os `INSERT`/`UPDATE` em funções/triggers só executam quando uma operação futura as chama. Na instalação, os DML são criação/avanço do marcador auxiliar, sem limpeza ou atualização em massa do histórico público.

| Candidato | Incremento / preservação | Risco e pré-condição |
|---|---|---|
| 001 | Cria schema privado `portaria`, marcador, perfis, confirmações de saída e conferências; FKs `RESTRICT`, sem importar/remover histórico | Confere fingerprint **antes** de mudar buckets. Schema/marker inesperados ou RPC SECURITY DEFINER antiga exposta bloqueiam. Marcador anterior sem a nova estrutura de recuperação exige outra adaptação; não sobrescrever |
| 002 | Adiciona seis campos de autoria sem backfill, defaults para futuras operações, gates RLS cumulativos e guards; permite CNH com validade ausente | `DROP POLICY`/`DROP TRIGGER` substituem somente objetos próprios `portaria_*` na transação; policies históricas permanecem. `REVOKE`/gates bloqueiam anônimo, inativo, exclusão de histórico e atalhos, podendo interromper o frontend antigo. Perfis ativos passam a ser necessários |
| 003 | RPC atômico de saída, Cobli, assinatura, seis evidências condicionais, visitantes/documentos e retorno; não materializa checklists históricos em massa | Exige `portaria-evidence` privado, 10 MiB e MIME JPEG/PNG/WebP, contrato gerenciado compatível. RPC/trigger de operações novas atualiza disponibilidade e cria registros legitimamente; não é conciliação automática dos 17 casos |
| 004 | Fecha gestão de buckets/arquivos pela API; mantém objetos/caminhos/owners; resolve CNH legada por correspondência única | Exige os quatro buckets antigos privados, alterados pelo painel/API em operação separada. Links públicos anteriores deixam de funcionar; o frontend usa URLs assinadas. `REVOKE` pode afetar clientes antigos; não reabrir publicidade como rollback |
| 005 | Cria encomendas/eventos, retirada com lock/idempotência, referências e resultados de conferência imutáveis; contrato 3 | Depende 001–004 e `portaria-parcels` privado, 10 MiB, JPEG/PNG/WebP. Rejeita objetos inesperados. Postflight 05 é específico deste estágio, **antes** de 006 |
| 006 | Preserva o critério antigo como `compatibility_v1`, novas conferências como `physical_v2`, última saída fixada e autoria/Timeline futura; contrato 4 | Remove uma constraint própria antiga e a substitui por constraints de significado/consistência. Adiciona campos, sem reclassificar resultados anteriores ou inventar autoria. Definição antiga inesperada bloqueia. Novos RPCs substituem comportamento; não executar frontend contrato 4 sobre pacote parcial |

Idempotência é **limitada ao estágio e à revisão previstos**. Não reaplicar 001–006 inteiros sobre contrato 4 nem usar isso para trocar comprovante/estratégia. Não executar templates com `REPLACE_*`, `supabase/dev`, `supabase/database.sql` ou replay das 21 migrations. Se algum candidato já foi aplicado, parar e inventariar essa versão antes de produzir outro incremento.

Os seis templates tiveram hashes alterados por esta revisão das guardas de recuperação; todos os arquivos renderizados/recibos anteriores ficam obsoletos. `originalSourceHashes` e a liberação recusam pacotes antigos. `scripts/review-original-hashes.ts` recalcula somente hashes locais; `.cache/original-review/candidate-hashes.json` contém o pacote atual, **não aprovado/não aplicado**. Hashes finais de SQL renderizado serão diferentes dos templates e precisarão de aprovação explícita.

## Correções locais e proteções mantidas

- `portaria-parcels` agora é aceito em URLs **assinadas** do projeto fixado. URLs públicas, outro bucket/domínio e URL sem token são recusados. `signedFileUrl` continua com expiração de dez minutos; paths legados são resolvidos pelo servidor, sem fallback para URL pública persistida. URLs assinadas são segredos temporários: não registrar em logs, exportações ou relatórios. [Buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- Auth continua com `signInWithPassword`, sessão separada por projeto, perfil ativo resolvido no banco por `auth.uid()`, papéis admin/porteiro, tratamento de logout e revalidação. Usuário não atribui seu perfil. O SDK segue proibido em `metadata-only`; login/refresh são operações reais futuras, não testes de leitura.
- RLS restritiva neutraliza permissões antigas amplas; funções SECURITY DEFINER têm `search_path` fixado, checagem de ator e EXECUTE controlado. Não liberar `anon` ou service_role para fazer testes passarem. [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
- `VITE_SUPABASE_URL` deve coincidir exatamente com o projeto original autorizado; `VITE_SUPABASE_ANON_KEY` recebe apenas chave pública anon/publishable com hash fixado; `VITE_PUBLIC_APP_URL` coincide com a origem aprovada. São valores de frontend, nunca local de senha, secret/service_role ou connection string. Arquivos locais continuam ignorados; nada foi configurado nesta execução. [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- HTTPS publicado continua condicionado à liberação original e aprovação de publicação. Service worker permanece desativado; modo demo e suas fixtures continuam sem conexão real.

### Dispensa explícita, sem comprovante fictício

O caminho com backup continua suportado, mas agora existe `no-backup-risk-accepted`:

1. Documento privado conforme `original-recovery-waiver.example.json`, em `.secrets/original-recovery-waiver.json`, registra decisão já expressa pelo usuário, data UTC, projeto, hash do inventário e os **seis hashes atuais**. Não contém credenciais, nomes de usuários ou registros. O exemplo permanece não aceito/incompleto para não constituir autorização por si só.
2. Recibo privado de liberação conforme `original-release-approval.example.json` referencia o SHA-256 exato desse documento. No caminho sem backup, `restoreVerified` e `storageBackupVerified` devem permanecer **false**, e `backupReceiptSha256` vazio. Não usar o checksum da dispensa como hash de backup.
3. O preparador só renderiza SQL liberável quando a decisão é válida e `sqlApproved` estiver expressamente aprovado; sem isso, placeholders de bloqueio permanecem. A dispensa isolada não libera SQL, build operacional, sessão ou escrita.
4. O marcador SQL registra estratégia e `recovery_evidence_sha256`; `backup_sha256` é gerado como **NULL** nesse caminho. Frontend exige igualdade da estratégia/hash/contrato, além de projeto, SQL e perfil; não aceita marcador de backup como se fosse dispensa ou vice-versa.
5. `original:authorize-write` continua interativo, exige todos os seis SQLs atuais/inteiros, inventário, hash exato do pacote, confirmações de aplicação/postflight e aprovação de operações reais. Ele não executa SQL ou acessa o projeto. Recibo é declaração humana, não prova automática de execução remota; é necessário confrontar evidências do painel/postflight.

Nenhum desses recibos reais ou arquivos de destino foi criado/alterado por esta revisão. Não preencher `remoteMigrationsApplied`, `postflightValidated`, `frontendOperationsApproved` ou `deploymentApproved` antecipadamente.

## Sequência mínima futura — depende de autorização específica

As operações podem ser aprovadas como um pacote delimitado (SQLs finais + buckets + perfis + janela), sem pedir aprovação para cada comando local. A aprovação atual cobre apenas preparação. Publicação e testes que gravem registros/Auth devem constar expressamente da autorização futura correspondente.

| Passo | Operação futura | Antes / depois / interrupção |
|---|---|---|
| 1. Conferir e aprovar | Confirmar painel/projeto e se `portaria` já existe; repetir inventário se houver mudança e obter baseline agregado `01`, `03`, `04`; revisar SQLs finais/hashes, contas/perfis e privacidade | Salvar somente metadados/contagens/digests privados. Dispensa não substitui comparação. Parar por fingerprint diferente, schema inesperado, conta indefinida, duplicidade/órfão/conflito novo. Os 17 casos e 65 URLs são ressalvas conhecidas, não gatilhos para corrigir automaticamente |
| 2. Preparar localmente | Com parâmetros fornecidos só no terminal local, `original:configure` fixa projeto/chave pública em metadata-only; preencher documento de dispensa e recibo no escopo exato; `original:prepare` gera candidatos para revisão | Não enviar credenciais ao chat. `sqlApproved` somente depois de aprovar o conteúdo; conferir de novo os hashes renderizados finais e registrar `approvedSqlBundleSha256`. `original:prepare` não aplica nada. Não executar `authorize-write` ainda |
| 3. Janela e fundação | Suspender frontend antigo, integrações/jobs/importações relevantes; conferir projeto e aplicar 001, depois 002, um arquivo/transação por vez | Não presumir ausência de escritas porque está sem usuários. Fingerprint de 001 corresponde ao estado anterior às mudanças de buckets. Após cada lote, verificar COMMIT, objetos/marker e ausência de mudança no baseline histórico; erro/timeouts: parar, não seguir nem retirar guardas |
| 4. Storage e restante | No painel/API aprovado: tornar privados os quatro buckets existentes; criar privados `portaria-evidence` e `portaria-parcels`, 10 MiB, JPEG/PNG/WebP. Aplicar 003, 004, 005; executar postflight 05; aplicar 006 | Não usar SQL direto nas linhas Storage. Preservar limites/MIME legados compatíveis, inclusive PDFs legítimos; não apagar arquivos para ajustar restrição. Confirmar todos os seis privados. Em 05, contrato 3 e bucket de encomendas = 1; inconsistências = 0, itens explicitamente de revisão podem existir. Após 006, marcador contrato 4 = 1 |
| 5. Perfis e validação | Atribuir perfis somente a contas Auth existentes e aprovadas por cópia privada do modelo manual (agora contrato 4); criar contas pelo painel apenas se aprovado/necessário. Executar 02 e 06 e repetir 01/03/04 antes de testes funcionais | 02 exige pelo menos um admin ativo; contas sem perfil/inativas são informativas e não devem ser habilitadas em massa. 06 exige seis buckets privados, marcador coerente e zero inconsistências. Dez contagens/digests 04 devem coincidir com T0, inclusive IDs/documentos. Divergência inesperada: manter sistema fechado; ausência de backup não autoriza ignorá-la |
| 6. Operar e publicar | Com autorização para testes reais: preencher confirmações verdadeiras, executar liberação local interativa e `dev:original`; testar admin/porteiro/inativo/anônimo com dados fictícios novos. Depois aprovar domínio HTTPS, build original e publicação controlada | Testar assinatura/Cobli, motivo+seis fotos, retorno, visitantes por câmera, funcionários sem motivo, encomenda/foto/retirada concorrente, conferência/histórico, Banco/exportações/inspeções/Timeline/Realtime. Novas fixtures alteram contagens legitimamente: comparar baseline antes delas. Sem credenciais em screenshots/traces. Falha de JWT/RLS/privacidade ou comportamento bloqueia publicação |

O modelo de perfis existente exige duas contas distintas e não sobrescreve perfis já presentes. Se houver só uma conta ou perfil anterior, revisar essa operação pontual antes de executar; não criar usuários por SQL nem assumir UUIDs. Publicação automática do GitHub/Netlify não foi verificada externamente.

**Publicação ainda tem bloqueios deliberados:** Vite recusa ambiente Netlify; `netlify.toml` chama build devcloud e variáveis/target originais são locais ignorados. Não basta mudar o comando ou remover o bloqueio. Após aprovação de publicação/domínio, preparar build original autorizado e publicar o artefato controladamente, ou revisar CI com aprovação específica, sem credenciais administrativas. Conferir headers CSP/HTTPS/cache/SPA e origem Auth; os headers do servidor Vite não se transferem automaticamente para hospedagem estática. Nenhum deploy foi preparado como execução automática neste pacote.

## Rollback e risco sem backup

| Operação / momento | Recuperação possível | Limite |
|---|---|---|
| Erro antes de COMMIT de um candidato | Rollback da **transação daquele arquivo** desfaz suas DDL, policies, triggers, grants e marcador; confirmar sessão fora de transação abortada | Não desfaz candidatos já commitados, efeitos do painel ou outros clientes. Se cair a conexão, verificar estado antes de repetir; não supor que não commitou |
| 001–006 depois de COMMIT | Correção incremental revisada ou recomposição manual de definições/permissões | Não há down automático seguro nem histórico completo de definições remotas exportado. Não fazer `DROP portaria CASCADE`, apagar dados novos ou abrir RLS como retorno rápido |
| Privacidade/criação/configuração de bucket pelo painel/API | Correção manual autorizada de configuração, preservando objetos | Fora da transação SQL. Reabrir documentos ao público não é rollback aceitável; manter privados mesmo se frontend falhar. Não apagar bucket/arquivos criados durante uso |
| Auth, perfis e sessões | Ajuste manual autorizado; bloquear/inativar perfil conforme decisão | SQL de perfil só é transacional em seu próprio lote; criar usuário/login/refresh/revogar sessões não é revertido por rollback das migrations. Não excluir usuários em cascata |
| Upload + RPC | RPC faz rollback de seu banco se falhar; tentativa pode ser repetida conforme idempotência | Upload é outra operação: pode restar arquivo privado sem referência. Não apagar após timeout, pois RPC pode ter commitado. Limpeza exige revisão/autorização separada |
| Frontend/domínio/publicação | Bloquear frontend/novas operações, reverter artefato compatível ou corrigir build | `original:lock` só muda configuração local após reinício/fechar abas; não revoga JWTs nem encerra outras estações. Frontend antigo pode ser incompatível com RLS/contrato novo |
| Perda/corrupção/exclusão depois de COMMIT | Investigar e reconstruir manualmente o que for possível | **Sem backup/restauração ensaiada não há retorno integral garantido**, PITR próprio, RPO ou RTO comprovado. Contagens/hashes detectam divergências, não recuperam conteúdo; documentos/fotos/assinaturas, IDs/vínculos ou material Auth podem ser irrecuperáveis. Recadastrar não reproduz prova histórica original |

Durante qualquer falha: manter indisponibilidade, preservar objetos/arquivos existentes, registrar só agregados e preparar correção específica. Aceitação de perda não autoriza reset do banco, exclusão de dados pessoais, apagar buckets, recriar Auth ou usar pacote de banco vazio. Nenhuma operação destrutiva de recuperação está implicitamente autorizada.

## Checklist desta preparação

- [x] Instalação/backup/laboratório suspensos; documentos anteriores sinalizados como históricos.
- [x] Seis candidatos revisados e guardas adaptadas para dispensa registrada, sem backup fictício.
- [x] Correção de URL assinada de encomendas e conferência estrita do marcador Auth.
- [x] Comparação local repetida; ordem, dependências, verificações e limites de rollback definidos.
- [ ] Autorizar/atualizar inventário e baseline remoto da janela; confirmar se nenhum candidato já foi aplicado.
- [x] Configurar destino original localmente em metadata-only, conferir pinagem e renderizar seis SQLs bloqueados para revisão.
- [ ] Registrar documento/recibo reais no escopo aprovado, sem habilitar operações antecipadas.
- [ ] Aprovar SQLs finais/hashes, buckets, perfis e janela; somente então executar o pacote remotamente.
- [ ] Validar serviços reais e autorizar operações controladas; depois aprovar publicação e conferir CI/hosting.

Validação local da revisão funcional anterior: **146 testes aprovados**, lint, TypeScript e build demo aprovados; hashes dos seis candidatos recalculados/conferidos. A suíte inclui 001–006 em PostgreSQL WASM sintético, preservação, RLS, dispensa e postflight 06. Três falhas iniciais por datas UTC/São Paulo das fixtures foram resolvidas fixando datas nos testes, sem mudar a reconstrução de pátio. Na configuração de 28/10, foram repetidos **34 testes de configuração/liberação**, todos aprovados, e conferido o bloqueio SDK com os arquivos efetivos. Nenhum login, HTTP real, navegador ou migration foi executado nessa etapa. Configuração original existe apenas em metadata-only; não existe recibo de liberação ativo nem conexão liberada.

Os testes usam memória/dados fictícios, não são laboratório restaurado e não comprovam compatibilidade integral com serviços gerenciados ou dados remotos atuais. Para execução futura dos testes/build demo, usar dependências locais existentes; não instalar nem iniciar ferramentas de backup.
