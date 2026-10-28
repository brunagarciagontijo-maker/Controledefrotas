# Revisão consolidada do original — 27/10/2026

**Decisão vigente posterior:** [implantação simplificada sem backup/laboratório](ORIGINAL_SIMPLIFIED_DEPLOY.md). Instalações suspensas e risco de perda aceito; cláusulas antigas de backup obrigatório abaixo foram substituídas. As ressalvas estruturais/de privacidade e a exigência de autorização específica de operações remotas continuam. Os seis templates agora vinculam estratégia de recuperação/dispensa; hashes anteriores não são atuais.

**Atualização vigente:** [REFINEMENTS_STATUS.md](REFINEMENTS_STATUS.md). Novo candidato 006, pacote seis/contrato 4; nenhum foi aplicado. OK/NOK agora representam presença física, com divergência calculada separadamente e resultados antigos preservados.

**Complemento atual:** [Pátio, encomendas e conferência diária](PATIO_LOGISTICS_IMPLEMENTATION.md). Pacote ampliado para 001–005 e contrato 3. Os 17 casos continuam sem correção automática; a nova conferência distingue flag atual de evidência histórica. Hashes antigos precisam de nova preparação/revisão. Nenhum SQL foi aplicado.

Esta revisão usa somente os três arquivos locais fornecidos pelo usuário: inventário estrutural, contrato gerenciado e contagens de integridade. Nenhuma conexão ao projeto, alteração remota, migration remota, instalação, commit ou publicação foi executada. Os SQLs incrementais são candidatos locais, sem aprovação de execução.

## Evidências confirmadas

| Tema | Resultado e limite da evidência |
|---|---|
| Integridade consultada | Duplicidades, conflitos entre fluxos, flag no pátio com saída aberta, órfãos consultados e divergências de placa: zero. Não equivale a verificar todas as regras ou todos os arquivos |
| Totais de referência | `vehicle_records`: 185; `operational_movements`: 144; `access_records`: 90. São contagens no momento da consulta, não comprovantes de backup |
| Pátio | 17 veículos com flag fora e sem saída aberta. A ausência de movimento não comprova presença física nem autoriza alterar a flag |
| Documentos | 65 registros de pessoas com URL HTTP(S) em `cnh_file_url`. Não comprova 65 arquivos distintos, URLs válidas, origem no projeto ou acesso público |
| Estrutura pública | Dez tabelas com RLS. Seis campos de autoria ausentes, 39 diferenças de obrigatoriedade e oito hashes de defaults divergentes da referência DEV. Não há alteração automática dos valores antigos |
| Contrato gerenciado | `storage.objects.bucket_id/name/owner_id` são text e `metadata` é jsonb. Colunas necessárias de Auth/Storage presentes no complemento recebido. Isso não prova o comportamento HTTP do serviço |
| Funções anteriores | As três funções públicas inventariadas são SECURITY INVOKER; anon/authenticated têm EXECUTE. EXECUTE sozinho não demonstra bypass de RLS. Os geradores necessários aos defaults são preservados |
| Policies e grants | 57 policies no inventário, 41 com condição incondicional. Há grants administrativos de tabela para papéis da API; os candidatos fecham `TRUNCATE`, que não é limitado por RLS, e restringem o acesso cumulativamente |
| Buckets | `driver-cnh-documents` e `vehicle-operation-photos` públicos; `person-documents` e `access-documents` privados. Nenhum dos quatro apresenta limite de tamanho/MIME no inventário |
| Histórico/Realtime | Ledger com 21 versões, uma divergindo da correspondente local: original `20260720175616`, local `20260720130000`. Não reparar/reexecutar. Inspeções já pertencem a `supabase_realtime`; nenhuma publicação será alterada pelos candidatos |

## Preservação por candidato

| Candidato | O que faz | Preservação e risco a aprovar |
|---|---|---|
| `001_foundation.sql` | Confere aprovação, backup e fingerprint; cria schema auxiliar e tabelas de perfis/saídas/conferências | Não recria tabelas existentes nem gera novos IDs para registros antigos. FKs novas preservam vínculos e podem impedir exclusões futuras de contas/veículos relacionados. O fingerprint deve ser conferido antes de qualquer mudança manual de bucket |
| `002_authorization.sql` | Adiciona seis colunas nullable de autoria, defaults para novas escritas, restrições de RLS, triggers de autoria e grants mínimos | Não preenche autoria antiga, não muda sequências/códigos/URLs nem executa UPDATE nos registros existentes. A aplicação antiga pode parar de funcionar. Exclusão de histórico pela API é bloqueada inclusive para admin; catálogo vinculado também não pode apagar histórico por cascata |
| `003_operations.sql` | Cria RPCs e triggers para novas saídas, retornos, conferência, evidências e novos documentos | Não faz carga ou reconciliação em massa. Retorno altera a flag somente em transição real de aberto para concluído. Checklists antigos não são reinterpretados e itens existentes não são sobrescritos pelo materializador |
| `004_private_files.sql` | Fecha grants administrativos da API e restringe escrita/exclusão em objetos; resolve CNH por caminho existente em bucket privado | Não move, renomeia, copia, apaga arquivos nem altera linhas de buckets. Exige privacidade já ajustada pelo painel/API. Bloqueia substituição/exclusão dos arquivos pelo frontend; novos documentos usam novos caminhos |

Não há DROP/TRUNCATE de tabelas ou DELETE de registros/objetos nos candidatos. Os DROP POLICY/TRIGGER referem-se aos controles `portaria_*` que o pacote instala; policies e triggers anteriores são mantidos. A reaplicação é testada, mas não substitui revisão de uma instalação parcial. Alterações locais nos candidatos invalidam hashes SQL gerados anteriormente: renderizar e revisar novamente antes de aprovar.

**Não é possível declarar preservação integral no original apenas com metadados e testes fictícios.** A condição de aceite é restauração comprovada, hashes dos campos originais e manifestos dos arquivos conferidos durante a janela. Veja o [procedimento de backup](ORIGINAL_BACKUP_RUNBOOK.md).

## Os 17 veículos

Manter as 17 flags como estão. Os candidatos não executam qualquer UPDATE de conciliação. A interface deixa o veículo fora da lista de novas saídas e sinaliza necessidade de conferência, sem declarar automaticamente corrupção. Conferência usa a flag cadastrada e os dois fluxos; não muda o cadastro.

O responsável operacional deve conferir privadamente presença física, condição administrativa, última entrada/saída e eventual marcação manual. Inativo/manutenção não é sinônimo de fora do pátio. Se for necessária correção, propor operação individual identificada por ID em cópia privada, com estado anterior esperado, justificativa, autoria, aprovação e recuperação por veículo; nunca `UPDATE` coletivo baseado somente na ausência de movimentos. Não criar saídas/devoluções fictícias para fechar diferenças.

`03_documents_patio_readonly.sql` permite obter a distribuição desses casos por status sem exportar as placas. A lista individual para conferência física deve permanecer em ambiente restrito; não enviar ao chat, Git ou fixtures.

## As 65 URLs e os arquivos

Os candidatos mantêm os valores de `cnh_file_url` intactos. O novo frontend usa `cnh_file_path` e solicita URL temporária somente após autenticação/perfil. Não segue URLs antigas como fallback e não infere acesso público pela presença de HTTP(S).

| Caso a conferir | Tratamento seguro |
|---|---|
| Caminho aponta para exatamente um objeto nos dois buckets de CNH conhecidos | Resolver o bucket verificado e assinar temporariamente; documentos antigos não precisam ganhar proprietário novo para serem lidos pelo perfil autorizado |
| Somente URL, sem caminho | Não abrir automaticamente nem apagar o valor. Localizar a origem em revisão privada e propor mapeamento incremental separado, se necessário |
| Caminho ausente no Storage | Investigar backup/origem/arquivo faltante. Não fabricar documento nem esconder a pendência |
| Mesmo caminho nos dois buckets | Resolver ambiguidade privadamente. O RPC recusa escolher um bucket silenciosamente |
| URL externa ou assinada/expirada | Confirmar a origem em ambiente restrito; não fazer downloads automáticos nem copiar tokens para relatório |
| Referências de acessos/fotos | Conferir também `access_records.document_file_path` e `operational_photos.file_path`; o problema não se limita às CNHs |

O novo `03_documents_patio_readonly.sql` classifica essas referências com contagens e metadados de buckets, sem retornar caminhos/URLs ou acessá-los. Arquivo listado no banco ainda precisa ter seus bytes e checksum verificados no backup.

Tornar os dois buckets públicos privados preserva os objetos no lugar, mas muda a forma de acesso. Links públicos antigos deixam de ser um mecanismo válido; consumidores externos e caches precisam de avaliação. URLs temporárias também são credenciais de acesso enquanto válidas; não registrar/copiar seus valores. Não prometer revogação de cópias previamente baixadas nem recuperação de arquivo já ausente.

Uploads de substituição no original foram ajustados para conservar o arquivo anterior. Em falha/resposta incerta, o frontend não apaga o arquivo novo automaticamente. Isso preserva evidências, mas pode acumular órfãos e custo; limpeza futura exige inventário de referências e operação administrativa aprovada. Não alterar MIME/tamanho dos buckets legados antes de conhecer PDFs, HEIC/HEIF e tamanhos reais; a restrição JPEG/PNG/WebP de 10 MiB é exclusiva do novo bucket de evidências.

## Permissões propostas

- Anônimo: sem acesso operacional, perfis/documentos ou gestão de buckets. Somente marcador de ambiente não pessoal onde necessário.
- Sem perfil ou inativo: sem dados operacionais/Storage da aplicação.
- Porteiro: consultas operacionais e operações permitidas, cadastro limitado de visitante/terceiro, saída pelo RPC, retorno e conferência; não promove perfis, não gerencia frota/funcionários e não apaga histórico.
- Admin ativo: gestão permitida dos cadastros, inspeções e operações; sem exclusão de histórico pela API, sem alteração direta das evidências/checklists e sem sobrescrever/apagar os arquivos da aplicação. Arquivar/desativar cadastros relacionados preserva vínculos.
- Painel, proprietário do banco e service_role: podem ter poderes que ultrapassam RLS. Nenhum controle frontend substitui restrição e auditoria desse acesso. Não colocar chave privilegiada em `VITE_*`.

A intenção é manter policies antigas e acrescentar restrições cumulativas. Metadados com hashes não provam semântica completa: o ensaio deve testar permissões efetivas por JWT e operações HTTP reais. Remoção dos privilégios de gestão de `storage.buckets` pela API e bloqueio de exclusão são decisões de segurança propostas para aprovação com os SQLs; nenhum deles foi aplicado.

## Ordem de execução futura e recuperação

| Etapa | Ação e aprovação necessária | Validação / recuperação |
|---|---|---|
| 1 | Usuário: obter auditoria documental agregada e conferir plano/backup disponível no painel | Sem escrita. Resolver bloqueios documentais e estimar tamanho/custo; não alterar os 17 estados |
| 2 | Aprovar aquisição segura do backup e destino temporário de restauração, orçamento, acesso e retenção | Executar o runbook fora deste repositório; sem restauração comprovada, não aprovar migrations |
| 3 | Administrador: ensaiar os quatro candidatos e operações Storage em destino isolado, após aprovação explícita desse ensaio | Comparar SHA-256 das dez tabelas e manifesto Storage; validar permissões/fluxos sem integrações externas. Testes fictícios locais não substituem esse ensaio |
| 4 | Aprovar SQLs finais renderizados/hashes, mudanças Storage, perfis, janela e política de exclusão | Revisar nova versão se qualquer arquivo mudar. Nenhum pacote de banco vazio ou reparo do ledger |
| 5 | Suspender todas as origens de escrita autorizadamente; repetir inventário, integridade, `03` e `04`; obter backup final consistente | Totais 185/144/90 são referência anterior: se mudou, investigar e registrar novo baseline. Mudança estrutural invalida fingerprint e exige nova aprovação |
| 6 | Administrador: aplicar `001`, depois `002` | Fingerprint ANTES de mudar buckets. Falha: parar e rollback da transação do lote; lote anterior confirmado permanece. Não continuar para contornar erro |
| 7 | Operação manual aprovada no painel/API: criar bucket privado de evidências e privatizar os existentes; aplicar `003`, depois `004`; atribuir perfis aprovados | Não fazer DML em `storage.buckets`, trocar IDs/caminhos ou remover objetos. Passos de painel não pertencem à transação SQL e exigem registro próprio |
| 8 | Executar `02`, `01`, `03` e `04` somente leitura durante manutenção | Hash/contagem das dez tabelas devem coincidir com o baseline final; 17 flags e URLs continuam preservadas. Conferir arquivos e grants/privacidade. Divergência: parar, preservar evidências e investigar |
| 9 | Autorizar testes controlados do frontend com Auth real e operações especificadas; registrar recibo e liberar localmente | Validar admin/porteiro/inativo, tentativas inválidas, documentos, Cobli, seis fotos, retornos e Realtime. Registrar testes novos separadamente; não apagá-los como parte automática do rollback |
| 10 | Aprovar publicação separadamente e conferir GitHub/Netlify/HTTPS/Auth | Bloqueios de deploy permanecem. Não reabrir acesso público para fazer o código antigo funcionar |

Falha antes do COMMIT: rollback do lote. Falha depois de qualquer COMMIT: manter manutenção, bloquear operações novas e priorizar correção incremental aprovada. Os quatro arquivos não formam uma única transação; mudanças no painel também não revertem automaticamente. Não existe down migration destrutivo autorizado. Se for necessário restaurar, obter aprovação específica, conferir RPO/RTO, preservar escritas posteriores e restaurar banco e arquivos de forma consistente; nunca executar restauração sobre o original para apenas testar backup.

## Pronto / pendente

Prontos localmente: revisão dos três arquivos, candidatos corrigidos, regressões de preservação e permissões, auditoria agregada adicional, consulta de comparação SHA-256 e procedimentos. `npm run check` concluiu com lint, TypeScript, 89 testes e build aprovados. `npm run test:browser` concluiu com 14 testes desktop/móvel. Após o último ajuste de grants no candidato `004`, os 25 testes incrementais também foram repetidos e passaram. Os testes PostgreSQL são sintéticos em memória e não constituem ensaio de recuperação do original.

Pendentes: localização/classificação real das 65 URLs e referências de arquivos, conferência física dos 17 casos, plano/método/orçamento de backup, cópia completa dos arquivos, restauração isolada e ensaio, fingerprint final e aprovação exata dos SQLs/Storage/perfis/testes/publicação. Não há recibo de backup/restauração aprovado nem liberação do frontend original nesta etapa.
