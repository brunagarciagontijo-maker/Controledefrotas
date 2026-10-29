# Atualização do banco existente — somente candidatos

**Vigente:** [integração simplificada sem backup](../../ORIGINAL_SIMPLIFIED_DEPLOY.md). Backup completo/laboratório dispensados pelo usuário, instalações suspensas. Os seis candidatos agora conferem estratégia de recuperação/dispensa e novo marcador; recibos/hashes anteriores ficaram obsoletos. Não houve aplicação remota. Referências de backup anteriores abaixo são históricas.

**Backup no Free:** [plano consolidado](../../ORIGINAL_BACKUP_FREE_PLAN.md) e [scripts/SQLs de preparação](backup/README.md). Nenhuma exportação/restauração foi realizada; os SQLs de backup não integram as seis migrations.

**Pacote atual 001–006, contrato 4:** [refinamentos e preservação](../../REFINEMENTS_STATUS.md). `006_physical_checks_timeline.sql` depende dos cinco anteriores atuais; `06_refinements_postflight_readonly.sql` valida esse estágio. Postflight 05 aplica-se antes de 006, pois seu critério anterior de OK/NOK foi substituído sem reescrever registros antigos. Nenhum SQL foi aplicado remotamente.

Siga [ORIGINAL_ACCESS.md](../../ORIGINAL_ACCESS.md) e [ORIGINAL_RELEASE.md](../../ORIGINAL_RELEASE.md).

- `00_inventory_readonly.sql`: inventário de metadados, sem registros pessoais; testado com histórico de migrations presente e ausente. Textos das policies, funções e defaults não são exportados.
- `00b_managed_contract_readonly.sql`: complemento somente leitura de colunas Auth/Storage e permissões EXECUTE, sem registros pessoais.
- `01_integrity_readonly.sql`: contagens de inconsistências e de registros existentes, após conferir os nomes no inventário.
- `02_postflight_readonly.sql`: validação administrativa agregada depois de uma aplicação futura aprovada.
- `03_documents_patio_readonly.sql`: diagnóstico adicional agregado dos 17 casos e referências documentais; não retorna caminhos/URLs nem baixa arquivos.
- `04_preservation_readonly.sql`: contagens e SHA-256 dos campos originais das dez tabelas, para comparação antes/depois sem operações concorrentes.
- `structure_fingerprint.sql`: fingerprint estrutural somente leitura. `original:prepare` incorpora o fragmento no candidato 001; não executar templates com placeholders.
- `incremental/001`–`006`: candidatos transacionais com pré-condições; não executados remotamente. 005 depende dos quatro anteriores atuais e bucket privado `portaria-parcels`; 006 depende de 005, com contrato final 4. [Regras e validação](../../REFINEMENTS_STATUS.md).
- `05_logistics_postflight_readonly.sql`: contagens do estágio 005/contrato 3, antes de 006.
- `06_refinements_postflight_readonly.sql`: validações do critério físico e autoria depois de uma aplicação futura aprovada de 006.
- `manual/profile_assignment.example.sql`: modelo bloqueado para atribuição aprovada de perfis a contas Auth existentes; não cria contas nem deve ser executado como está.
- `schema-contract.json`: somente metadados estruturais derivados do inventário; os testes sintéticos reproduzem as diferenças de colunas confirmadas, sem copiar dados reais.

Nenhum script local contém cliente SQL remoto, password, service_role ou comando para aplicar migrations. A preparação não equivale a aprovação. Não executar `supabase/dev`, `supabase/database.sql` ou as 21 migrations históricas no projeto original.

Os três arquivos de inventário/contrato/integridade foram recebidos e comparados localmente. Veja a [revisão consolidada](../../ORIGINAL_PREDEPLOY_REVIEW.md) e o [runbook de backup](../../ORIGINAL_BACKUP_RUNBOOK.md). Os testes não reproduzem o serviço Auth/Storage, todas as proteções gerenciadas, as integrações ou os arquivos efetivos. O diagnóstico de objetos/URLs e a recuperação dos arquivos reais continuam pendentes.

Os candidatos não inserem nem atualizam linhas em `storage.buckets`: criação do bucket de evidências e privacidade dos buckets existentes exigem operações aprovadas pelo painel/API Storage. A ordem está em [ORIGINAL_RELEASE.md](../../ORIGINAL_RELEASE.md).
