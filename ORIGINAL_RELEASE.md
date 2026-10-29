# Atualização segura do Sistema Portaria original

**Validação final de leitura — 28/10/2026:** [resultado e consulta manual preparada](ORIGINAL_FINAL_READONLY_VALIDATION.md). Perfil metadata-only confirmado, SDK bloqueado e zero consultas remotas; a proteção não foi contornada. Falta o novo JSON do SQL Editor para confirmar o estado atual. Ausência de baseline anterior 04 impede comprovação retroativa do conteúdo dos registros por digests; nenhum SQL de alteração foi aprovado.

**28/10/2026 — configuração local concluída:** [estado e comandos posteriores](ORIGINAL_CONFIGURATION_STATUS.md). Destino original configurado em metadata-only, sem release e com SDK bloqueado; nenhuma consulta remota. Seis SQLs renderizados para revisão em `.cache/original-review/sql`, hashes conferidos, **guardas de aprovação mantidas**. Nenhuma migration foi executada nem liberação de escrita/publicação concedida. Esta atualização substitui afirmações de ausência de configuração em revisões anteriores abaixo.

**DECISÃO VIGENTE — backup/laboratório dispensados:** seguir [ORIGINAL_SIMPLIFIED_DEPLOY.md](ORIGINAL_SIMPLIFIED_DEPLOY.md). Instalações estão suspensas. A nova alternativa registra dispensa explícita sem afirmar backup/restauração, preserva destino/SQL exato/perfis/RLS/Storage privado e mantém toda execução remota bloqueada até autorização específica. Os seis templates e o marcador de recuperação mudaram; recibos/renderizações anteriores são inválidos. As referências a backup obrigatório nas seções antigas abaixo são histórico e foram substituídas pelo novo plano. Não retomar instalações/exportações automaticamente.

**Verificação local desta revisão:** 146 testes aprovados, incluindo contrato sintético 001–006, preservação, RLS, dispensa sem backup fictício, URLs assinadas de encomendas e postflight 06; lint, TypeScript e build demo aprovados. Três falhas iniciais de testes de conferência dependiam da virada UTC/São Paulo das fixtures: datas dos testes foram fixadas, sem alterar as regras do pátio, e a suíte completa passou. Hashes dos seis templates recalculados e conferidos. Não foram executados navegador, login ou testes HTTP reais nesta revisão; compatibilidade dos serviços remotos segue pendente. Nenhum arquivo de destino/recibo real existe, nenhuma escrita foi liberada e nenhum SQL remoto foi executado.

**Backup vigente no plano Free:** [ORIGINAL_BACKUP_FREE_PLAN.md](ORIGINAL_BACKUP_FREE_PLAN.md). O usuário confirmou ausência de backups gerenciados. O conjunto próprio e o ensaio isolado ainda não foram executados; não liberar SQL nem operação real sem essa prova. A auditoria documental 03 foi recebida: 236 objetos catalogados, cobertura dos bytes ainda pendente.

**Pacote vigente:** [REFINEMENTS_STATUS.md](REFINEMENTS_STATUS.md): seis candidatos 001–006, contrato 4. 006 preserva o critério anterior das conferências e prepara autoria/Timeline. Essa revisão substitui as referências cinco/3 e quatro/2 abaixo. Aprovar novamente os arquivos finais/hashes; não reaplicar candidatos anteriores por cima do contrato 4.

**Revisão anterior:** [Pátio, encomendas e conferência diária](PATIO_LOGISTICS_IMPLEMENTATION.md) documenta o estágio 001–005/contrato 3. O pacote vigente inclui 006 e contrato 4. 003 já contempla Cobli sem checkbox extra; os seis arquivos finais e seus hashes precisam de aprovação específica.

## Situação desta entrega

**Atualização após os três inventários:** leia primeiro [ORIGINAL_PREDEPLOY_REVIEW.md](ORIGINAL_PREDEPLOY_REVIEW.md) e [ORIGINAL_BACKUP_RUNBOOK.md](ORIGINAL_BACKUP_RUNBOOK.md). Contrato gerenciado e contagens já foram recebidos. Candidatos foram endurecidos para preservar históricos/checklists/arquivos, manter os 17 estados sem conciliação automática e remover privilégios administrativos da API. Hashes SQL preparados antes desta revisão precisam ser gerados e aprovados novamente. Nenhuma aplicação remota foi realizada.

O frontend e os candidatos incrementais foram preparados localmente. O inventário exportado pelo usuário foi recebido em `.secrets/original-inventory.json` e comparado localmente. Esta execução não se conectou ao original. O [relatório consolidado](ORIGINAL_IMPLEMENTATION.md) registra as diferenças confirmadas e as verificações pendentes. As migrations abaixo **não estão aprovadas nem aplicadas**.

Use `npm run dev` ou `npm run dev:demo` para experimentar a interface com dados fictícios em memória. Não há servidor Supabase, credenciais, upload externo ou persistência entre recargas neste modo. Cadastros avançados demonstram a interface existente, mas não simulam todas as operações administrativas.

`npm run original:configure` fixa o identificador e o hash de uma chave pública em arquivos ignorados. Não conecta. Inicialmente `npm run dev:original` reconhece esse destino e mantém o SDK, login, refresh de sessão, Storage, Realtime e qualquer escrita bloqueados. Login real também altera informações de Auth; por isso não faz parte da etapa somente leitura. Uma liberação de operação do frontend original precisa de aprovação específica posterior e validação do contrato de banco. `original:authorize-write` foi preparado para essa etapa futura, mas não foi executado. `build:original` recusa configuração ausente ou somente leitura.

## Inventário e comparação

1. Execute manualmente apenas `supabase/original/00_inventory_readonly.sql`, conforme [ORIGINAL_ACCESS.md](ORIGINAL_ACCESS.md).
2. Salve apenas o JSON de metadados em `.secrets/original-inventory.json`. Não salve dumps de registros neste arquivo.
3. Execute `npm run original:compare`. O comando usa o inventário local e um PostgreSQL WASM com o schema de referência da Fase 1. Não conecta ao projeto. O relatório fica em `.cache/original-review/comparison.json`.
4. Confira tabelas, tipos, nullability, grants, funções expostas, triggers, RLS, policies, buckets e versões do histórico. Nomes/hashes não comprovam equivalência semântica; funções SECURITY DEFINER expostas exigem revisão individual no painel, sem publicar seus corpos quando contiverem literais sensíveis.
   O primeiro inventário confirmou dez tabelas públicas com RLS, seis campos de autoria ausentes e 39 diferenças de obrigatoriedade. O frontend aceita os valores opcionais existentes; não há preenchimento automático de dados antigos. O ledger tem 21 versões, com uma versão diferente da correspondente no repositório: não reparar, reexecutar ou sobrescrever esse histórico.
5. As contagens de `01_integrity_readonly.sql` foram recebidas: 185 registros legados, 144 movimentos e 90 acessos; zero nas verificações de duplicidades/conflitos/órfãos/placas. Os 17 veículos fora sem movimento e as 65 URLs HTTP(S) exigem revisão, sem correção automática. Repetir as contagens antes/depois da janela.
6. O complemento `00b_managed_contract_readonly.sql` também foi recebido. Colunas gerenciadas necessárias e EXECUTE foram conferidos; funções anteriores são SECURITY INVOKER. O fingerprint não substitui a revisão de permissões efetivas. As quatro migrations continuam sem aprovação/aplicação.
7. Obter o diagnóstico agregado `03_documents_patio_readonly.sql` e preparar o baseline `04_preservation_readonly.sql`. A ordem e os critérios atuais de liberação estão na revisão consolidada; os documentos antigos de Fase 1 não se aplicam ao original.

As 21 migrations históricas permanecem intactas. O pacote `supabase/dev` continua apenas como referência/teste em memória e nunca deve ser executado no original. Não há conversão nem preenchimento automático de registros antigos com uma associação Cobli presumida.

## Backup verificável — antes de aprovar qualquer escrita

1. Confira projeto, região, responsáveis, janela de indisponibilidade, horário do último backup e mecanismo de restauração disponível no plano. Não altere plano, PITR ou configurações nesta etapa.
2. Obtenha backup consistente de estrutura e dados, incluindo Auth, permissões e histórico. Use o mecanismo disponível no painel ou um administrador com `pg_dump` compatível, em sessão separada e credenciais fornecidas fora do chat. Nenhum comando de dump é executado por este repositório.
3. Mantenha o backup criptografado em local protegido **fora do repositório e de pastas sincronizadas**. `.gitignore` não impede sincronização por OneDrive/SharePoint ou acesso de outros usuários.
4. Preserve também os arquivos binários do Storage, além dos metadados, com manifesto de quantidade, tamanho e checksums em área privada. O backup do banco Supabase não inclui os arquivos do Storage. [Documentação oficial](https://supabase.com/docs/guides/platform/backups).
5. Valide o arquivo, o inventário do conteúdo e, principalmente, um ensaio de restauração em destino temporário isolado e explicitamente autorizado. Desative integrações, jobs, webhooks e envios nesse destino antes de qualquer teste. Não restaurar sobre o original nem criar recursos automaticamente.
6. Compare contagens, constraints, vínculos e amostras de arquivos por verificação privada. Não copie registros para fixtures, screenshots, logs ou relatórios versionados. Registre somente sucesso/falha, totais, hashes e horário.
7. Para calcular **somente checksum/tamanho** de um arquivo local, use `npm run backup:verify -- --file CAMINHO_PRIVADO_DO_BACKUP`. O recibo não declara a restauração validada. Não confundir checksum com backup completo ou recuperável.
8. Somente após o ensaio documentado, preencha o recibo privado de liberação e aprove os arquivos SQL finais e seus hashes. Aprovação genérica da estratégia não aprova as migrations.

## Candidatos incrementais — revisão obrigatória

| Lote | Finalidade | Efeito e condição de parada |
|---|---|---|
| `001_foundation.sql` | Schema auxiliar `portaria`, perfis, confirmação Cobli/evidências e conferências | Não recria tabelas existentes. Exige hash estrutural igual ao inventário, backup e aprovação. Recusa schema auxiliar inesperado e RPC SECURITY DEFINER anterior exposta sem revisão |
| `002_authorization.sql` | Permissões mínimas, restrições cumulativas de RLS, autoria e retorno | Preserva policies anteriores e acrescenta restrições; bloqueia atalhos de novas saídas, exclusão de histórico e cascatas por catálogo vinculado. Pode interromper o frontend antigo: aplicar somente em janela aprovada |
| `003_operations.sql` | RPC de saída idempotente, validação das seis fotos, pátio, conferência e foto documental | Exige contrato Storage conferido e bucket `portaria-evidence` já criado privado pelo painel/API, com limite de 10 MiB e MIME JPEG/PNG/WebP. Não cria contas Auth nem altera linhas dos buckets |
| `004_private_files.sql` | Restringir acesso a arquivos e resolver CNH legada por caminho verificado | Exige buckets privados; fecha TRUNCATE/gestão de buckets pela API e bloqueia sobrescrita/exclusão de arquivos no frontend. Preserva objetos/caminhos; não modifica linhas dos buckets |
| `005_daily_yard_parcels.sql` | Encomendas, retirada atômica e referências imutáveis da conferência diária | Depende de 001–004 atuais, marcador 2 e bucket privado `portaria-parcels` criado pelo painel/API com aprovação própria. Não reescreve históricos/flags; eleva o contrato a 3 |
| `006_physical_checks_timeline.sql` | OK/NOK como presença física, última saída fixada na referência e autoria/Timeline | Depende de 005 e marcador 3; preserva o significado e campos dos resultados anteriores. Não reescreve dados públicos nem preenche autoria antiga; eleva o contrato a 4 |

Sequência vigente: 001 → 002; conferir/criar buckets privados aprovados de evidências e legados; 003 → 004; conferir/criar bucket privado de encomendas; 005 e postflight 05; 006 e postflight 06. Comparar preservação 04 ao baseline em janela sem escritas e conferir Storage/perfis com 02. Somente depois dos seis candidatos aprovados/aplicados, validações e autorização específica, liberar frontend de contrato 4. Cada criação ou mudança de bucket/perfil continua exigindo aprovação própria. Nenhuma etapa foi executada remotamente.

Os scripts usam transação, `lock_timeout` e pré-condições. A reaplicação foi testada num contrato sintético ajustado às diferenças de colunas do inventário recebido. Isso não comprova compatibilidade integral com os serviços gerenciados e os registros existentes. Se houver extensões, RPCs, triggers ou tipos diferentes, o candidato deve ser ajustado antes da aprovação.

Depois de receber o inventário e fixar o destino, `npm run original:prepare` gera cópias para revisão em `.cache/original-review/sql`. Sem recibo válido, os SQLs gerados continuam bloqueados. Nenhum comando deste fluxo aplica SQL ou possui acesso remoto.

O exemplo `original-release-approval.example.json` não é autorização. O recibo real fica em `.secrets/original-release-approval.json`; deve registrar o projeto, hash do inventário, evidência verificável do backup/restauração e aprovação humana específica dos SQLs. Confira os hashes finais em `sha256.json` depois da renderização. Se qualquer arquivo mudar, a revisão e a aprovação anteriores deixam de valer.

Os indicadores booleanos do recibo são declarações humanas, não provas automáticas. Conserve as evidências privadas de restauração, cobertura do Storage, aprovação, execução e validação. O checksum sozinho não demonstra recuperabilidade.

## Perfis, Auth, Storage e publicação — ações futuras aprovadas separadamente

- Identificar contas Auth existentes sem exportar usuários; não redefinir senhas, criar contas, convidar pessoas ou associar perfis automaticamente.
- Atribuir manualmente `admin` e `porteiro` em `portaria.profiles` para UUIDs conferidos no painel, em SQL privado a aprovar. Não usar `user_metadata` para conceder privilégios. As contas existentes e seus dados permanecem preservados; sem perfil ativo, o novo aplicativo recusa acesso.
- Conferir providers, signup, URLs permitidas, MFA, hooks, SMTP e políticas do projeto. Não alterar essas configurações sem autorização específica.
- Conferir todos os buckets e objetos privados, inclusive caminhos de CNH oriundos de `driver-cnh-documents`. O inventário confirmou `driver-cnh-documents` e `vehicle-operation-photos` públicos. A mudança para privado e a criação de `portaria-evidence` devem ser operações separadas pelo painel/API Storage, aprovadas e documentadas. Não contornar triggers de proteção com SQL direto. O resolvedor recusa caminhos ausentes ou ambíguos em vez de escolher um bucket silenciosamente.
- A captura usa câmera e imagens JPEG/PNG/WebP. O servidor verifica formato, caminho, proprietário e presença das evidências; não consegue comprovar por SQL o conteúdo visual da imagem nem que outro cliente utilizou uma câmera. Faça teste em aparelho real, HTTPS e com documentos artificiais.
- `vehicle_inspection_requests` já pertence a `supabase_realtime` no inventário. A publicação não é alterada pelos candidatos desta entrega; validar entrega das inspeções com JWT e RLS reais após aprovação.
- Conferir GitHub/Netlify manualmente: branch de produção, hooks, deploy previews, variáveis e publicação automática. Nenhuma configuração externa foi consultada/alterada. O bloqueio Netlify desta branch permanece e exige revisão antes de publicar.

## Validação e recuperação

### Sequência da janela futura — não executada

| Ordem | Responsável e ação após aprovação específica | Validação / parada e recuperação |
|---|---|---|
| 1 | Metadados/contagens recebidos; usuário: obter auditoria documental `03` e conferir backup/plano; Codex: analisar os agregados adicionais | Parar diante de incompatibilidade ou inconsistência sem decisão. Nenhuma correção de dados presumida |
| 2 | Usuário/administrador: backup de banco e Storage, ensaio de restauração isolado e evidências; revisar SQL final, perfis e operações Storage | Sem restauração comprovada não iniciar escrita; manter original em sua condição atual |
| 3 | Usuário: aprovar os SQLs finais renderizados e hashes, privacidade/criação de buckets e janela; suspender operações e automações concorrentes | Inventário final deve corresponder ao fingerprint aprovado; mudança exige nova comparação e aprovação |
| 4 | Administrador: aplicar apenas os candidatos incrementais `001` e `002`, nesta ordem, no projeto conferido | O `001` compara o fingerprint ANTES de mudar buckets. Falha implica parada e rollback do lote. O frontend anterior pode perder acesso com `002` |
| 5 | Usuário/administrador: pelo painel/API Storage, criar `portaria-evidence` privado, 10 MiB, JPEG/PNG/WebP; tornar privados os quatro buckets existentes | Conferir privacidade sem baixar documentos reais ao repositório. Se falhar, manter manutenção; não reabrir buckets públicos automaticamente |
| 6 | Administrador: aplicar `003` e `004`; atribuir perfis aprovados a contas existentes usando cópia privada do modelo manual | Cada lote verifica pré-condições. Não sobrescrever perfis nem criar usuários por suposição. Preservar registros anteriores |
| 7 | Administrador: executar postflight e repetir contagens; usuário: aprovar separadamente o escopo de testes reais controlados, incluindo Auth e eventuais registros de teste | Conferir preservação dos registros, objetos privados e perfis. `postflightValidated` registra essa conferência agregada; não declara que os fluxos HTTP já foram testados. Sem sucesso, manter aplicação bloqueada |
| 8 | Usuário: registrar recibo e aprovação específica das operações controladas do frontend; só então executar `original:authorize-write` localmente e reiniciar servidor. Realizar os testes autorizados antes da publicação | O comando exige manifesto íntegro, seis confirmações e frase explícita. Não executa SQL nem conecta; o frontend confere marcador remoto, backup, versão e perfil. Validar JWT/RLS/admin/porteiro/inativo, Cobli, seis fotos, retorno, câmera, documentos e Realtime. Falha exige bloquear novas operações e revisar, preservando os registros |
| 9 | Usuário: aprovar publicação e conferir GitHub/Netlify, origem HTTPS e Auth; Codex: preparar a publicação autorizada em etapa separada | O bloqueio Netlify permanece nesta entrega. A origem HTTPS exige `deploymentApproved`; não há deploy automático autorizado |

Na etapa 5, avalie e aprove também limites de tamanho/MIME nos buckets legados de acordo com os arquivos já existentes; não invalidar PDFs legítimos de terceiros/CNH ao copiar a restrição exclusiva das fotos de evidência. Não apagar arquivos para adequar limites.

A ativação local utiliza `.env.original.local`, `original.target.local.json` e o recibo privado; URL do projeto, hash da chave pública e origem devem corresponder exatamente. Não há fallback para outro projeto. HTTPS só é aceito no perfil original com liberação de escrita e aprovação de publicação; revisão local continua em loopback. Variáveis `VITE_` são públicas: nunca incluir senha, chave secreta ou service_role.

`npm run original:lock` volta o destino local para inventário e exige reiniciar o servidor e fechar abas já abertas. Não revoga JWTs, não interrompe outros computadores e não constitui rollback remoto. Não execute `original:authorize-write` nesta entrega.

Antes da janela: salvar inventário, hashes, backup/restauração e totais agregados; concluir testes locais; revisar plano de retorno; aprovar SQL exato e publicação separadamente. Interromper operações durante a comparação final e a aplicação aprovada para impedir concorrência com o frontend anterior.

Durante a aplicação futura: conferir identificador do painel antes de cada lote. Erro implica parada e rollback da transação do lote. Não remover restrições, editar dados em massa ou abrir policies para fazer um teste passar.

Depois: executar `02_postflight_readonly.sql`, repetir `01` e `03` e comparar `04_preservation_readonly.sql` com o baseline final antes de permitir operações. Contagem sozinha não prova preservação de conteúdo/IDs/vínculos; o hash inclui os campos originais. Conferir manifesto dos arquivos separadamente. Após autorização dos testes reais, validar admin, porteiro, inativo e sem perfil por JWT, bloqueio de atalhos/exclusão, Cobli, seis fotos, retorno, documentos, divergências e Realtime.

Se falhar depois do commit: parar o novo frontend e novas operações; manter evidências e registros já gravados. Priorizar correção incremental revisada. Reverter o código antigo sem considerar as novas permissões pode impedir o atendimento; reabrir políticas/buckets públicos não é rollback seguro. Restaurar backup pode descartar operações posteriores ao backup e exige decisão explícita, conciliação e restauração dos arquivos compatíveis. Nenhum down migration destrutivo foi preparado.
