# Pátio unificado, encomendas e conferência diária

**Revisão posterior:** [REFINEMENTS_STATUS.md](REFINEMENTS_STATUS.md) substitui o critério OK/NOK e a composição de menus deste relatório anterior. OK significa encontrado e NOK não encontrado, sem bloqueio pela expectativa. Banco/Relatórios foram unificados em Gestão; pacote atual 001–006, contrato 4. Referências antigas continuam preservadas e identificadas pelo critério original.

Implementação local na branch `desenvolvimento`. Nenhum acesso ou alteração remota, migration remota, commit ou publicação foi realizado. Prévia: `http://127.0.0.1:5173/`, com dados fictícios em memória, descartados ao recarregar.

## Checklist implementado

- Registro integrado ao Pátio. Cinco menus inferiores: Banco, Relatórios, Pátio, Veículos e Sair. URLs antigas `tab=registro`/`tab=form` e Novo registro do Banco abrem a saída dentro do Pátio.
- Veículos mantém busca textual/código, disponibilidade, saídas, retornos, checklist de entrada e devolução legada. Pessoas mantém funcionários, terceiros, visitantes, veículos pessoais e acessos. Histórico, detalhes, cadastros administrativos, filtros, exportações, assinaturas, inspeções e timeline foram preservados.
- Cobli: somente seleção obrigatória associado/não associado, sem checkbox adicional ou consulta automática. Associado dispensa as seis fotos condicionais; não associado exige motivo e seis itens distintos. Assinatura obrigatória nas saídas; seleção preservada no histórico e protegida no retorno.
- Somente o botão Ler QR Code da busca do Pátio foi retirado. Geração de QR da frota e interpretação protegida de links/códigos continuam disponíveis.
- Encomendas: recebimento com data/hora editável, destinatário e foto obrigatória por câmera ou upload; pesquisa, datas, status, CSV e foto/detalhes. Retirada exige nome, com data/hora e autoria do servidor, preservando recebimento/fotografia. Locks e unicidade impedem dupla retirada. Repetição de recebimento conserva tentativa e objeto, sem sobrescrever arquivos.
- Conferência diária: dia/hora, referências salvas, pendente/OK/NOK diretamente na lista, justificativa, veículo encontrado não listado, busca/filtros/CSV e totais. Novas rodadas têm resultados próprios; anteriores não são sobrescritas.
- Identidade original mantida: logo, cores, fundo, tipografia, cards, ícones, botões, navegação e responsividade. A composição dos menus segue o novo pedido.

## Critério da conferência

1. O servidor cruza os intervalos de saída/retorno de `vehicle_records` e `operational_movements`, até a referência no fuso `America/Sao_Paulo`. Início da saída significa ausência; instante do retorno significa presença. Intervalos idênticos são unidos; um veículo ocupa uma linha, mesmo aparecendo nos dois fluxos.
2. A referência guarda ID, placa, descrição, estado esperado e motivos da revisão. Movimentações/cadastros posteriores não recalculam a lista salva. Resultado registra hora real da conferência e usuário autenticado, além da referência histórica. Consultar uma data anterior não fabrica uma conferência realizada naquela data.
3. Sem evidência suficiente, retorno ausente em registro encerrado, identidade divergente ou fontes conflitantes, o estado é desconhecido. Flag atual não comprova presença histórica. OK fica bloqueado; NOK exige observação e presença observada. Não se inventa o período anterior ao primeiro evento confiável nem a frota anterior a exclusões históricas de cadastro.
4. A lista inclui ausentes e desconhecidos para permitir localizar veículos inesperados e pendências. Filtro Esperados limita aos comprovadamente presentes. Esperados conta esse grupo; Conferidos/Pendentes contam todas as linhas da referência; Divergentes conta NOK. Desconhecido pendente exige revisão, não conta automaticamente como NOK.
5. Os 17 casos fora sem saída aberta são alertas da situação **atual**, separados da expectativa histórica, sem correção das flags. Um retorno comprovado pode indicar presença mantendo o alerta da flag atual. Sem prova, permanece desconhecido. O número pode mudar com operações reais futuras; não se fixa uma lista artificial de 17 IDs.
6. Veículo cadastrado e não esperado: NOK na própria linha registra que foi encontrado. Encontrado não listado atende placa ausente da referência e não cadastra automaticamente um veículo na frota.
7. Conferências do modelo anterior continuam consultáveis por dia, sem reinterpretar seus critérios. A placa exibida vem do cadastro atual, pois o modelo anterior não guardava snapshot de placa. Seus dados permanecem preservados.

## Banco e segurança

Novo `005_daily_yard_parcels.sql`: depende de **001 → 002 → 003 → 004**, com a versão atual de 003 sem confirmação Cobli redundante. Todos são candidatos, não aplicados. As 21 migrations históricas continuam intactas.

005 cria cinco tabelas auxiliares em `portaria`: `parcels`, `parcel_events`, `yard_sessions`, `yard_items`, `yard_checks`. RLS ativa e nenhum acesso direto do cliente; RPCs com `search_path` vazio conferem perfil ativo, identidade do servidor e dados. Unicidade, locks e transações protegem integridade. FKs usam `ON DELETE RESTRICT` para preservar vínculos.

Aplicar 005 não carrega, exclui, concilia nem reescreve as dez tabelas existentes. Operações futuras de encomenda/conferência gravam somente dados novos do módulo. A captura da referência obtém brevemente lock SHARE nas três fontes: medir sua duração no ensaio. Não altera disponibilidade nem instala sincronização retroativa.

Pré-requisito manual, com aprovação específica: criar pelo painel/API Storage o bucket `portaria-parcels`, privado, limite 10 MiB e MIME JPEG/PNG/WebP. O SQL não cria/atualiza linhas de buckets. Recebimento verifica objeto privado existente, proprietário, caminho, MIME e tamanho. Leitura exige perfil ativo; sobrescrita/exclusão de fotos é negada à API, inclusive ao administrador do aplicativo, por restrições cumulativas às policies antigas. Fotos remotas usam URL assinada por 10 minutos; não se persiste URL pública. Upload não confirmado pode deixar órfão: revisar sem apagar automaticamente. Planejar retenção e custos.

Frontend exige contrato original **schema_version=3**. Preparação/liberação exigem cinco candidatos e igualdade dos templates atuais com os revisados. Hashes anteriores de 003 e pacotes de quatro arquivos estão invalidados. `scripts/review-original-hashes.ts` gera `.cache/original-review/candidate-hashes.json`: são hashes de **templates bloqueados**, sem destino ou aprovação, não de SQL final renderizado. Hash definitivo depende de destino/baseline/recibo, preparados futuramente. Nenhum acesso original foi configurado ou liberado nesta execução.

Se versões anteriores de 001–004 já tiverem sido aplicadas por outro procedimento, parar e inventariar seu conteúdo antes de definir atualizações adicionais. Não reaplicar cegamente arquivos alterados, nem executar 003 após o marcador 3. Nunca executar pacote DEV, `supabase/database.sql` ou migrations históricas no original.

## Arquivos principais desta atualização

| Área | Arquivos |
|---|---|
| Navegação/saída | `src/App.tsx`, `src/components/UnifiedPortaria.tsx`, `CompanyDepartureForm.tsx`, `src/domain/portaria.ts`, `src/services/portariaService.ts` |
| Novos módulos | `src/components/DailyYard.tsx`, `ParcelsView.tsx`, `src/domain/yard.ts`, `logisticsStore.ts`, `src/services/logisticsService.ts`, `src/utils/downloadRows.ts` |
| Contrato/liberação | `src/types/database.ts`, `src/config/originalRelease.ts`, `src/lib/environment.ts`, `src/auth/AuthProvider.tsx`, `scripts/prepare-original.ts`, `authorize-original-write.ts`, `original-sources.ts`, `review-original-hashes.ts` |
| SQL | `supabase/original/incremental/003_operations.sql`, `005_daily_yard_parcels.sql`, `supabase/original/05_logistics_postflight_readonly.sql` |
| Testes | `tests/yard.test.ts`, `logistics-database.test.ts`, `original-sources.test.ts`, testes existentes Cobli/ambiente; `tests/browser/logistics.spec.ts`, `camera-fixture.ts`, regressão visual/Portaria e `scripts/check-local-preview.mjs` |

Componentes abreviados estão em `src/components`; stores em `src/domain`; scripts em `scripts`; SQLs incrementais em `supabase/original/incremental`; testes seguem as respectivas pastas indicadas. Outras alterações locais autorizadas em pedidos anteriores não foram descartadas.

## Implantação e recuperação futuras — exigem aprovação

1. Revisar prévia fictícia: Cobli associado com assinatura; não associado com motivo/seis fotos; retornos e devolução legada; Pessoas; encomenda por câmera/upload, retirada, filtros/foto; OK/NOK, desconhecido, encontrado e consulta por referências/datas. Testar aparelho físico: emulação não comprova câmera/permissões reais. Em outro aparelho `127.0.0.1` aponta para ele próprio; uma prévia HTTPS acessível precisa de configuração separada.
2. Obter backup verificável do banco **e bytes do Storage**, fora do repositório/pastas sincronizadas, com restauração ensaiada em destino isolado aprovado. Seguir `ORIGINAL_BACKUP_RUNBOOK.md`. Registrar baseline de contagens/hashes das dez tabelas e manifesto de arquivos em janela sem escritas. Checksum de dump sozinho não basta.
3. Reconfirmar estrutura/grants, policies efetivas, buckets e integrações/publicação desde os inventários. Auditoria privada das 65 URLs/documentos e revisão operacional dos 17 estados permanecem pendentes. Não presumir que as URLs sejam públicas ou 65 arquivos distintos.
4. Aprovar os cinco SQLs renderizados/hashes e, separadamente, operações no painel: privacidade dos buckets legados, criação dos buckets privados de evidências/encomendas e atribuição de perfis. Aplicar na ordem de `ORIGINAL_RELEASE.md`, com aplicação antiga parada, somente em janela aprovada.
5. Executar manualmente postflights 02 e 05, comparar 04 ao baseline e validar Auth/Storage/RLS via JWT/HTTP reais no ensaio aprovado. Em 05, `schema_version_3` e `private_parcels_bucket` devem ser 1; demais verificações devem ser 0, exceto objetos órfãos, que exigem revisão sem limpeza automática.
6. Liberar frontend original e publicar apenas com aprovação explícita, recibos novos, validação e contrato 3. Login também pode escrever em Auth. Prévia fictícia não comprova integração gerenciada.
7. Recuperação: transação SQL falhou, parar e confirmar rollback. Após commit, bloquear operações e preservar novas encomendas/conferências/fotos; não apagar tabelas nem restaurar backup sobre novas escritas sem reconciliação. Não reabrir RLS/buckets públicos para recuperar frontend antigo. Voltar somente para frontend compatível com contrato 3 ou manter indisponibilidade. SQL compensatório/restauração exige plano e aprovação próprios.

## Testes e limites

Validação completa: `npm run check` passou (lint, TypeScript, 114 testes e build). `npm run test:browser` passou: 38 cenários em desktop/celular, incluindo 14 comparações de imagens, sem atualizar snapshots nessa execução final. A primeira passagem gerou as referências novas e identificou seletores/nomes fictícios incorretos nos testes; foram corrigidos antes da passagem final. `node scripts/check-local-preview.mjs` confirmou HTTP 200, modo demo, cinco menus e zero requisições externas em 5173.

Cobertura: regras/fuso, PostgreSQL WASM com contrato sintético de colunas do inventário original e policies anteriores permissivas, hashes das dez tabelas, permissões/evidências/idempotência e navegador desktop/celular. Imagens comparativas em `.cache/visual-baselines`, ignoradas no Git.

Os testes não reproduzem integralmente serviços gerenciados Auth/Storage/PostgREST, concorrência entre conexões reais, todas as integrações externas ou bytes dos documentos existentes. Ensaio remoto de integração/desempenho/concorrência/restauração continua pendente de aprovação.
