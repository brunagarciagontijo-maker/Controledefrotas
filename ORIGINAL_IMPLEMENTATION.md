# Sistema Portaria — implementação local e diagnóstico do original

Data: 27/10/2026. Branch: `desenvolvimento`. Esta entrega modificou somente arquivos locais e executou verificações locais. Não houve consulta remota por este computador, escrita no original, instalação de ferramentas, commit, push, merge ou deploy. O inventário foi fornecido pelo usuário e contém metadados, não registros operacionais.

**Revisão posterior aos três arquivos recebidos:** [ORIGINAL_PREDEPLOY_REVIEW.md](ORIGINAL_PREDEPLOY_REVIEW.md) consolida contagens, análise dos 17 estados/65 URLs e candidatos corrigidos. O [runbook de backup](ORIGINAL_BACKUP_RUNBOOK.md) detalha cobertura e restauração. As pendências de recebimento abaixo foram substituídas por essa revisão; nenhum candidato foi aplicado remotamente.

## Melhorias implementadas

| Área | Comportamento implementado |
|---|---|
| Portaria | Área principal unifica saídas/retornos de veículos, entrada/saída de pessoas, disponíveis, conferências e histórico. Cadastros, relatórios e consultas anteriores continuam acessíveis conforme perfil |
| Saída da empresa | Exige motorista elegível e confirmação manual explícita da associação no Cobli. Não há integração automática com a API Cobli |
| Cobli associado | Dispensa checklist fotográfico de saída; registra a confirmação e a autoria. Não presume associação de registros antigos |
| Cobli não associado | Exige motivo informado pelo motorista e seis fotos: pneus, luzes, vidros, limpeza, odômetro e avarias. Bloqueia conclusão incompleta; captura guiada pela câmera |
| Consistência de saída | RPC candidata serializa tentativas, bloqueia veículo e verifica os dois fluxos antigos. Idempotência por tentativa e conteúdo evita dupla saída. Upload sem confirmação não é apagado automaticamente, pois uma resposta perdida pode ocultar uma transação concluída |
| Retorno | Preserva checklist e confirmação de saída; valida dados de retorno, normaliza itens e atualiza disponibilidade na mesma transação candidata |
| Pessoas | Visitante exige imagem documental capturada pela câmera e armazenamento privado. Funcionário não recebe campo Motivo da visita e grava motivo vazio. Terceiro mantém suporte anterior a documento PDF/imagem |
| Disponíveis | Concilia cadastro, indicador de pátio e movimentos abertos dos dois fluxos. Conferência física registra presença observada e divergência com justificativa, sem sobrescrever automaticamente o estado do veículo |
| Arquivos | Caminhos privados, URLs temporárias e resolução verificada da CNH legada. Evidências confirmadas imutáveis no acesso da aplicação; limpeza de órfãos depende de operação administrativa separada |
| Autorização | Perfis ativos admin/porteiro resolvidos pelo servidor. Sem confiança em papel salvo no navegador. Candidatos de RLS acumulam restrições sobre policies antigas; autoria e campos de saída protegidos no banco |
| Segurança de destino | Projeto, origem e hash da chave pública fixados. Perfil original inicialmente bloqueia inclusive Auth/refresh/Storage/Realtime. Futura liberação exige recibo, manifesto e aprovação explícita, além de marcador remoto compatível |
| Demonstração | `npm run dev` usa somente dados fictícios em memória, sem cliente Supabase. Fotos ficam em memória e desaparecem ao recarregar. Nenhum documento ou pessoa real é necessário |

A confirmação Cobli é humana; o sistema não comprova a associação no serviço externo. A câmera usa permissão do navegador, para ao encerrar a captura e precisa de HTTPS ou loopback. SQL valida existência, propriedade, caminho, tamanho e MIME, mas não comprova conteúdo visual nem a origem física de uma imagem enviada por outro cliente. A interface orienta fotografar todos os itens; a foto não declara automaticamente que o item está em boas condições.

## Estrutura e arquivos principais

Stack mantida: React 18, TypeScript, Vite, Tailwind, Supabase JS/PostgreSQL/Auth/Storage/Realtime. Os testes usam Node, PGlite e Playwright. Sem Docker/WSL/CLI novos.

| Grupo | Arquivos/pastas alterados ou adicionados relevantes |
|---|---|
| Navegação e fluxo | `src/App.tsx`, `src/components/UnifiedPortaria.tsx`, `CompanyDepartureForm.tsx`, `DepartureSummary.tsx`, `OperationalView.tsx`, `AccessControlView.tsx` |
| Captura e arquivos | `CameraCapture.tsx`, `PhotoChecklistCapture.tsx`, `PrivatePhotos.tsx`, `src/lib/privateFiles.ts`, `src/services/accessControlService.ts`, `operationalService.ts` |
| Regras e serviços | `src/domain/portaria.ts`, `src/domain/demoStore.ts`, `src/services/portariaService.ts`, serviços de veículos/inspeções/cadastros |
| Acesso e ambiente | `src/auth/`, `src/demo/`, `src/lib/environment.ts`, `runtime.ts`, `supabase.ts`, `src/main.tsx`, `vite.config.ts`, `.env.example`, `.gitignore`, exemplos de destino/recibo |
| Compatibilidade e apresentação | `src/types/database.ts`, `Input.tsx`, telas com datas opcionais, utilitários de data/exportação e `src/utils/diagnostics.ts`; erros compartilhados não imprimem mensagens brutas que possam conter dados |
| Ferramentas locais | `scripts/compare-original.ts`, `inventory-model.ts`, `prepare-original.ts`, `configure-original.ts`, `authorize-original-write.ts`, `lock-original.ts`, `verify-backup.mjs`; comandos em `package.json` |
| Banco candidato | `supabase/original/00*_readonly.sql`, consultas de integridade/postflight, `structure_fingerprint.sql`, `schema-contract.json`, `incremental/001`–`004`, modelo manual de perfis |
| Validação | `tests/*.test.ts`, `tests/browser/`, `playwright.config.ts` |
| Orientação | `README.md`, `ORIGINAL_ACCESS.md`, `ORIGINAL_RELEASE.md`, este relatório e avisos de estratégia substituída nos guias anteriores |

A árvore já continha mudanças da Fase 1, incluindo dependências, proteção do service worker, pacote DEV e saneamento de configuração. A lista acima identifica a implementação atual por área; o diff total da branch também inclui essas mudanças anteriores. As 21 migrations históricas continuam preservadas e são verificadas por hashes nos testes. O SQL para banco vazio permanece somente como referência/teste local.

## Banco original — fatos confirmados no inventário recebido

| Item | Resultado confirmado e implicação |
|---|---|
| Tabelas públicas | Dez: `vehicles`, `vehicle_records`, `drivers`, `people`, `personal_vehicles`, `access_records`, `operational_movements`, `operational_photos`, `operational_checklist_items`, `vehicle_inspection_requests`. Todas com RLS habilitada |
| Comparação com Fase 1 | 45 diferenças de colunas: seis campos de autoria ausentes e 39 diferenças de obrigatoriedade; nenhum tipo divergente nessa comparação. Obrigatoriedade diferente não prova existência de valores nulos |
| Auditoria ausente | `created_by` em `access_records`, `operational_movements`, `operational_photos`, `vehicle_records`; `requested_by_user_id` e `completed_by_user_id` em `vehicle_inspection_requests`. Os candidatos adicionam colunas sem inventar autoria dos dados antigos |
| Compatibilidade local | Datas opcionais e responsável opcional de veículo foram acomodados no frontend; valores antigos não são preenchidos ou reescritos |
| Defaults | Oito hashes de defaults diferem: seis `short_code` (`access_records`, `drivers`, `operational_movements`, `people`, `personal_vehicles`, `vehicles`), `access_records.host_person_name` e `operational_photos.file_url`. Hash diferente não demonstra diferença semântica; defaults, sequências e códigos existentes são preservados, sem reinicialização automática |
| Policies | 57 policies inventariadas; 41 com USING ou WITH CHECK incondicional. RLS habilitada sozinha não comprova isolamento. A comparação também registra grants; a revisão de permissões efetivas ainda exige complemento |
| Funções públicas | Três: `generate_short_code`, `generate_vehicle_mobile_code`, `update_updated_at_column`, sem SECURITY DEFINER no inventário. Não existem os novos RPCs de portaria |
| Triggers públicas | Atualização de timestamps; não há as novas garantias transacionais de checklist/pátio |
| Buckets | `access-documents` e `person-documents` privados; `driver-cnh-documents` e `vehicle-operation-photos` públicos. Os quatro não apresentam limite de tamanho/MIME no inventário |
| Storage gerenciado | Há triggers de proteção sobre buckets/objetos. Os candidatos não tentam contorná-las nem escrever diretamente nas linhas de `storage.buckets` |
| Realtime | `vehicle_inspection_requests` já publicada em `supabase_realtime`; nenhum candidato altera a publicação |
| Histórico | 21 versões no original e 21 arquivos históricos locais. Uma versão diverge: original `20260720175616`, repositório `20260720130000`. Não houve reparação nem replay do ledger |

O comparativo detalhado permanece local em `.cache/original-review/comparison.json`; o inventário bruto está ignorado em `.secrets/`. `schema-contract.json` contém apenas metadados selecionados e permite reproduzir diferenças de colunas nos testes sintéticos. Nenhuma linha de dados pessoais foi incorporada a fixtures ou relatório.

## Ainda não confirmado

- Colunas gerenciadas e permissões EXECUTE já foram recebidas/conferidas; serviços HTTP/JWT ainda precisam de ensaio autorizado.
- Integridade agregada já recebida: 185/144/90 registros; zero duplicidades/conflitos/órfãos/placas nas verificações executadas. Os 17 estados fora e 65 URLs permanecem para análise específica; obter `03_documents_patio_readonly.sql`.
- Backups recuperáveis, restauração, arquivos binários do Storage, caminhos legados ambíguos, plano/custos/limites do projeto e integrações externas.
- Configuração de providers/Auth, perfis de contas existentes, JWT real, entrega Realtime, comportamento HTTP do Storage e políticas efetivas no Supabase gerenciado.
- Captura em aparelhos reais, HTTPS, qualidade/legibilidade das imagens e operação com conexão instável.
- Branch de publicação, hooks, secrets e deploy automático de GitHub/Netlify. O bloqueio local de Netlify não demonstra a configuração externa.

Essas pendências impedem declarar a atualização pronta para produção. O frontend original continua bloqueado nesta entrega.

## Candidatos prontos para revisão — nenhum aplicado

1. `001_foundation.sql`: pré-condições de aprovação/backup/fingerprint; schema auxiliar, perfis, registro Cobli/evidências e conferências; preserva tabelas existentes.
2. `002_authorization.sql`: acesso por perfil ativo, restrições cumulativas de RLS, autoria, imutabilidade e campos incrementais. Bloqueia atalhos antigos de saída; precisa de janela sem operações concorrentes.
3. `003_operations.sql`: RPCs de saída/conferência/leitura, seis fotos privadas quando exigidas, validação documental e triggers de consistência. Exige bucket privado já criado pelo painel/API e contrato Storage confirmado.
4. `004_private_files.sql`: restrições complementares sobre objetos e resolução da CNH legada; exige buckets já privados, preserva objetos/caminhos.

O modelo separado `manual/profile_assignment.example.sql` exige aprovação específica e UUIDs conferidos de contas já existentes; não cria Auth nem sobrescreve perfis. Os candidatos têm pré-condições e reaplicação testada, mas não substituem a revisão final contra metadados atualizados e evidências de backup.

## Testes e limites da validação

`npm run check` passou: lint sem erros, TypeScript sem erros, 80 testes aprovados e build de referência concluído. `npm run test:browser` passou com 14 testes desktop/móvel. `npm run build:demo` concluiu com sucesso. `npm run build:original` foi recusado pelo bloqueio esperado de backup/aprovação/configuração ausentes; não gerou um artefato original autorizado. Lint e TypeScript também passaram após os últimos ajustes nas ferramentas locais. As portas dos servidores de teste foram encerradas ao final.

Os testes cobrem regras de Cobli/checklist/pessoas/disponibilidade, autorização, configuração e bloqueios, integridade transacional sintética, idempotência, retorno, autoria, permissões, documentos privados, preservação dos registros sintéticos e das migrations históricas. O inventário foi validado com tabela de histórico presente e ausente; não contém formatação Markdown e omite textos potencialmente sensíveis das policies. A sintaxe é verificada em PostgreSQL WASM, sem consulta remota.

Playwright exercita navegador desktop e móvel com câmera simulada pelo próprio navegador: associado/retorno, não associado com seis fotos, funcionário/visitante e divergência física, além de configuração bloqueada, sessão local antiga e limpeza restrita de service worker/cache. Não houve autenticação nem envio ao Supabase original. Esses testes não substituem testes de integração autorizados em serviços gerenciados.

## Checklist da próxima etapa

- [x] Receber e comparar complemento gerenciado e contagens agregadas, sem correção automática.
- [ ] Obter auditoria documental agregada adicional e conferir os 17 casos sem alterar estados automaticamente.
- [ ] Validar backup de banco **e arquivos Storage**, restauração isolada e evidências privadas; checksum não basta.
- [ ] Atualizar inventário antes da janela; revisar SQL final renderizado, hashes, perfis e operações manuais Storage; obter aprovação explícita de cada operação remota.
- [ ] Conferir automações e suspender operações concorrentes; aplicar somente lotes incrementais aprovados na ordem de [ORIGINAL_RELEASE.md](ORIGINAL_RELEASE.md).
- [ ] Validar preservação dos registros e documentos, JWT/RLS/admin/porteiro/inativo, fluxos reais controlados, Realtime e câmera em aparelho real, após autorização.
- [ ] Autorizar operações do frontend e registrar recibo local somente com evidências; a liberação local não aplica SQL.
- [ ] Conferir GitHub/Netlify, origem HTTPS e Auth; aprovar publicação em etapa separada. Não publicar esta branch automaticamente.

## Backup e recuperação

O procedimento completo, critérios por etapa e ordem manual/Codex estão em [ORIGINAL_RELEASE.md](ORIGINAL_RELEASE.md). Antes de qualquer mudança remota: backup consistente, proteção fora deste repositório/pasta sincronizada, cópia dos arquivos Storage e ensaio de restauração autorizado. O backup do banco não inclui os arquivos Storage, conforme a [documentação Supabase](https://supabase.com/docs/guides/platform/backups).

Falha durante um lote transacional exige parada e rollback desse lote. Falha após commit exige suspender novas operações, preservar evidências e avaliar correção incremental. Não reabrir RLS/buckets públicos nem remover tabelas de auditoria como recuperação automática. Restaurar backup pode descartar operações posteriores e depende de decisão explícita e conciliação. Não foi criado down migration destrutivo.
