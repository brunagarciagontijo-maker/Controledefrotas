# Backup próprio e recuperação — Supabase Free

> **SUSPENSO por decisão posterior do usuário:** backup completo e laboratório foram dispensados, com risco de perda de registros aceito. Não instalar ferramentas, adquirir backup ou executar este roteiro sem nova autorização. O procedimento vigente é [ORIGINAL_SIMPLIFIED_DEPLOY.md](ORIGINAL_SIMPLIFIED_DEPLOY.md); o restante deste documento é referência histórica, não requisito atual de implantação.

Plano vigente preparado em 27/10/2026, na branch `desenvolvimento`. **Não houve exportação, download de arquivos do projeto, consulta ao banco remoto, criação de recurso externo, restauração, execução de migration, alteração de configuração remota/global do Windows, instalação ou publicação.** Foram consultadas auditorias locais, informações da estação e documentação pública oficial. Com permissão pontual, foram criadas somente pastas vazias com ACL privada fora do repositório; criptografia ainda não configurada. Os verificadores foram testados com dados fictícios.

## Decisão recomendada

Manter o plano Free e produzir **um conjunto lógico de recuperação**: banco + papéis/permissões + arquivos Storage + metadados + configurações necessárias + evidências. Pela decisão atual do usuário, usar **este Windows como estação, uma única cópia local criptografada e laboratório local isolado**, preferencialmente com Docker se os pré-requisitos forem aprovados. Segunda cópia independente passa a ser melhoria futura, não condição obrigatória. Não instalar Docker/WSL nem adquirir backup nesta etapa. O diagnóstico e os comandos locais estão em [ORIGINAL_BACKUP_WINDOWS_STATION.md](ORIGINAL_BACKUP_WINDOWS_STATION.md).

**Risco da cópia única:** falha, roubo ou ransomware neste computador/disco, ou perda da senha, podem eliminar a recuperação. Pastas/partições e laboratório no mesmo disco não são redundância independente. O usuário aceitou a estratégia proporcional ao baixo volume/uso atual; isso não dispensa criptografia, integridade, cobertura e ensaio de restauração.

O Supabase recomenda exportações próprias e cópias externas para o Free; backup do banco não contém os bytes do Storage. Não depender de backups gerenciados, PITR ou clone pago. [Documentação de backups](https://supabase.com/docs/guides/platform/backups).

**Estado atual: plano preparado, backup ainda inexistente/não validado.** Sem ferramentas, destino privado, permissões e ensaio aprovados, a implantação permanece bloqueada. Ausência temporária de usuários não comprova ausência de escritas.

## Fatos confirmados nas auditorias locais

| Bucket | Objetos | Bytes informados pelo banco | Visibilidade registrada | Sem owner |
|---|---:|---:|---|---:|
| `access-documents` | 87 | 94.215.862 | Privado | 87 |
| `driver-cnh-documents` | 65 | 19.094.786 | Público | 65 |
| `person-documents` | 5 | 1.413.076 | Privado | 5 |
| `vehicle-operation-photos` | 79 | 262.869.380 | Público | 79 |
| **Total** | **236** | **377.593.104 ≈ 360,10 MiB** | 2 públicos / 2 privados | **236** |

Fonte: `.secrets/original-documents-patio.json`, salvo pelo usuário a partir de 03. Tamanho de metadados não é medição dos bytes recuperados. Usar um novo baseline na futura janela, não fixar 236 para sempre.

- Referências documentais: 87 de acessos, 78 de fotos operacionais e 70 de pessoas; todas têm caminho e correspondência única, sem ausências/ambiguidades no inventário. Os 79 objetos fotográficos frente a 78 referências não autorizam declarar exatamente um órfão nem apagar qualquer arquivo. Copiar todos os objetos.
- As 65 URLs HTTP(S) de pessoas têm caminho e objeto único. Isso não comprova que sejam todas públicas, válidas ou acessíveis: nenhuma URL foi seguida. Conservar campos/caminhos originais e usar acesso privado compatível após a migração.
- Dos 17 veículos fora sem saída aberta: 2 ativos, 5 em manutenção e 10 inativos. Preservar estados; não criar saídas/retornos fictícios.
- Inventário estrutural: PostgreSQL **17**, dez tabelas da aplicação, 146 colunas, 57 policies, 172 grants, 16 triggers, três funções e sete publicações no escopo inventariado. O ledger contém 21 migrations e a diferença de versão já documentada; preservar como está, sem repair/replay. Os inventários não cobrem necessariamente todo schema/customização do projeto.
- Totais operacionais recebidos anteriormente: 185 registros anteriores, 144 movimentos e 90 acessos. O baseline final pode diferir legitimamente e deve ser obtido na janela autorizada.
- Não foram identificadas referências FK públicas para `storage` no inventário recebido. Isso não dispensa procurar referências adicionais nem autoriza mudar IDs de objetos Storage: medir e revisar no ensaio.
- Os 236 owners nulos devem ser preservados como informação. Ausência de owner não equivale a acesso irrestrito: policies determinam acesso. [Ownership do Storage](https://supabase.com/docs/guides/storage/security/ownership).

## Ferramentas, permissões e limitações

| Dependência | Confirmado nesta execução | Necessário / alternativa |
|---|---|---|
| Node.js e Git | Encontrados | Suficientes para os verificadores locais; não fazem o dump |
| `pg_dump`, `pg_restore`, `psql`, `pg_dumpall` | Não encontrados no PATH; diretório PostgreSQL habitual ausente | Preparar clientes PostgreSQL 17 atualizados neste Windows após aprovação, preferindo binários/CLI sem servidor; não afirmar ausência absoluta de instalações portáteis |
| Supabase CLI, Docker, rclone, AWS CLI, 7-Zip | Não encontrados no PATH; caminhos usuais conferidos de Docker/AWS/7-Zip ausentes | Comandos e alternativas no documento da estação; instalação futura exige autorização, inclusive decisão de licença do runtime |
| Acesso PostgreSQL de backup | Ainda não testado | Credencial existente com leitura de todos os objetos necessários, Auth, Storage, histórico e catálogos; o acesso ao painel não prova esses privilégios |
| Acesso Storage completo | Ainda não testado | Credencial backend existente ou S3 autorizada que cubra os quatro buckets, sem depender de links públicos ou RLS de usuário comum |
| Arquivo local criptografado e chave de recuperação | Ainda não preparados; segunda mídia indisponível conforme usuário | Aprovar local, ACL, criptografia, retenção e teste de desbloqueio; `.secrets` não é cofre de backup. Segunda cópia é opcional nesta decisão, com risco registrado |
| Hospedeiro isolado de restauração | Este Windows foi escolhido; capacidade consultada no documento da estação | Viável com ajustes, ainda sem runtime preparado. Sem exposição pública, egress negado, serviços compatíveis. PostgreSQL simples valida apenas parte; não comprova Auth/Storage/PostgREST |

O `postgres` gerenciado não é superusuário irrestrito; permissões/owners de sistema podem impedir exportação/restauração de certos objetos. Não resolver isso concedendo privilégios na origem ou ignorando erros. [Limitações de papéis](https://supabase.com/docs/guides/database/postgres/roles-superuser).

Guardar conexão em `PGSERVICEFILE` e senha em `PGPASSFILE`, ambos fora do repositório e protegidos por ACL. Não usar URL com senha em argumentos, histórico, chat, `.env` do frontend ou logs. Usar TLS com validação do certificado; preferir conexão direta, ou pooler **Session** para rede apenas IPv4, nunca Transaction para esse procedimento. [Conexões Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), [serviços libpq](https://www.postgresql.org/docs/current/libpq-pgservice.html), [arquivo de senhas](https://www.postgresql.org/docs/current/libpq-pgpass.html).

Chaves S3 geradas têm poderes amplos e ignoram RLS: comando de leitura não transforma a credencial em read-only. Usar apenas em estação privada e retirar credenciais do laboratório antes da restauração. Criar/revogar credenciais, caso necessário, é operação futura com aprovação separada; não redefinir senhas por conveniência. [Autenticação S3](https://supabase.com/docs/guides/storage/s3/authentication).

O Free publicado nesta revisão inclui banco de 500 MB, Storage de 1 GB, franquias de transferência de 5 GB e limite de dois projetos ativos. Conferir uso/franquia restantes e elegibilidade no painel antes da aquisição; não são cotas disponíveis confirmadas deste projeto. Uma segunda leitura completa dos arquivos consome aproximadamente mais 360 MiB, fora banco/metadados/tentativas. Não há promessa de custo zero de infraestrutura/mídia/tráfego, somente ausência de upgrade previsto. [Limites e preços](https://supabase.com/pricing).

## Conjunto de recuperação e proteção

Guardar em diretório privado criptografado exclusivo de uma aquisição, fora de OneDrive/SharePoint/repositórios:

| Artefato privado | Cobertura / condição |
|---|---|
| `database.full.dump` | Arquivo mestre lógico custom, coerente, com dados, schemas alcançáveis, IDs, FKs, constraints, índices, tipos, defaults, funções, triggers, RLS/policies, owners/grants, sequências/valores, Auth, Storage e ledger |
| `roles.private.sql` + revisão de privilégios | Papéis, memberships e atributos permitidos, **sem senhas de papéis**. Não executar indiscriminadamente papéis reservados no destino |
| Metadados e TOC | Inventário final, capacidades 07, baselines 01/03/04, definições/customizações gerenciadas, publicações, extensões/versões e TOC do archive; arquivos de definições podem conter segredos |
| Storage | Metadados completos 08, inventários independentes S3/API inicial/final, bytes dos 236 objetos atuais e manifesto privado com bucket, nome exato, mapeamento de arquivo, tamanho real e SHA-256 |
| Configuração externa | Registro protegido de providers/redirects/SMTP/hooks, Edge Functions, secrets, jobs, webhooks, FDW/subscriptions, integrações, Realtime/publicações e publicação. Dump não recria automaticamente serviços/configuração de painel |
| Evidência | Hash/tamanho de cada artefato, versões, janela UTC, cobertura/exclusões explícitas, logs privados sem comandos contendo credenciais, prova de descriptografia e resultados do ensaio; registrar risco da cópia única |

SQL de funções, Auth/identidades e metadados podem conter dados pessoais ou material sensível. Não colocá-los no Git nem em anexos/chat. Relatórios de aprovação conterão apenas totais, checksums globais, cobertura e sucesso/falha. A chave da criptografia e eventual chave raiz do projeto ficam em custódia separada dos dados. Não usar Colab/armazenamento público para processar documentos.

## Sequência operacional futura

### 1. Aprovar meios e janela

Usuário/administrador confirma este Windows, arquivo criptografado local, responsável, laboratório isolado, retenção, RPO e RTO. Conferir espaço para staging, arquivo criptografado, restauração/releitura e serviços/imagens; 360 MiB de objetos não é dimensionamento completo do laboratório. A ausência de segunda mídia não bloqueia esta estratégia aprovada; registrar o risco e não chamar duas pastas de proteção independente. Nenhuma infraestrutura será criada automaticamente.

Solicitar aprovação específica para **aquisição somente leitura**, credenciais necessárias e eventual contenção das escritas. Identificar frontend/Netlify/GitHub, integrações, Auth, jobs, APIs e administração. Parar apenas a interface não garante quiescência, especialmente com policies permissivas. Se congelar escrita exigir configuração/RLS/credencial na origem, apresentar essa operação separadamente; não fazê-la implicitamente como parte do backup.

### 2. Confirmar cobertura, sem exportação cega

Após essa autorização futura, executar 07 e conferir todos os schemas, extensões, large objects, RLS e objetos sem SELECT. Confirmar também jobs, secrets/criptografia e configurações externas em revisão privada. A origem é o projeto conferido; hostname/porta/conta e certificado são verificados fora do chat.

Se não houver leitura de objeto necessário, ou houver arquivo/chave inacessível, registrar **lacuna bloqueante**. Não usar `--enable-row-security` para obter silenciosamente apenas linhas visíveis. Se o projeto tiver buckets adicionais desde 03, ampliar o escopo com revisão; não ignorá-los. Os verificadores atuais estão deliberadamente limitados aos quatro originais.

### 3. Fixar o ponto T0 e exportar PostgreSQL

Na janela coordenada, obter inventário/baselines finais. Um `pg_dump -Fc` nativo produz uma fotografia consistente do banco e permite revisar o conteúdo pelo TOC. Ele não inclui os papéis globais, que exigem captura separada. O arquivo mestre deve manter ownership/ACL e todos os schemas necessários; não aplicar filtros de portabilidade que escondam cobertura. [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [pg_dumpall](https://www.postgresql.org/docs/current/app-pg-dumpall.html).

O modelo **bloqueado** `scripts/backup/acquire-original.ps1.example` mostra comandos sem credenciais literais. Na execução futura: fonte somente leitura, `--no-password`, arquivo/log privados, verificação imediata de exit code, sem aceitar dump parcial. Preservar DDL/grants/roles estáveis durante a captura separada. O administrador confirma também autoria/definer/search_path, default privileges, publicações, sequences e objetos customizados de todos os schemas identificados.

**Contingência de permissões/compatibilidade:** o dump nativo completo pode falhar ou incluir objetos internos não portáveis. O CLI aplica filtros específicos e depende de Docker; não é substituto cego de cobertura. Seu export padrão e filtros de schemas gerenciados exigem complementos de Auth/Storage/customizações e histórico. Capturas separadas precisam de um snapshot compartilhado suportado, ou quiescência comprovada; não presumir que três comandos independentes formam um backup atômico. Sem obter cobertura coerente com as permissões disponíveis, parar e preparar um plano de exportação revisado por administrador, sem excluir silenciosamente dados. [Restauração da plataforma](https://supabase.com/docs/guides/self-hosting/restore-from-platform), [procedimento CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Não prometer backup físico/WAL ou acesso ao disco do servidor no Free. O conjunto próprio proposto é lógico e tem as limitações expressas neste plano.

### 4. Adquirir os quatro buckets integralmente

Guardar 08 em arquivo privado, sem imprimir nomes/caminhos. Listar todos os objetos S3/API com paginação completa, incluindo nomes sem referências e owners nulos. Comparar conjunto exato `(bucket,nome)`, versões/tamanhos e totais com os metadados do ponto T0. Ausência de listagem não é bucket vazio confirmado.

Baixar somente da origem para a mídia privada usando S3/Storage API suportada; nunca `sync --delete`, `move`, `purge`, alterações de bucket, URLs HTTP persistidas ou uploads para a origem. O coletor remoto **ainda precisa ser preparado/revisado e ensaiado** após aprovação; não está implementado nem executado neste pacote. Rclone é alternativa já documentada pelo fornecedor, mas não gera sozinho o formato/mapeamento UUID do verificador local. [Download de objetos](https://supabase.com/docs/guides/storage/management/download-objects).

Nomes S3 são sensíveis ao caso e podem ser incompatíveis com Windows. Usar coleta em filesystem compatível ou empacotamento com nomes UUID e mapa privado reversível, sem normalizar Unicode/case/caminhos. Preservar conteúdo, metadados disponíveis e headers pertinentes. Não assumir ETag como SHA-256: calcular hash dos bytes de cada arquivo, incluindo arquivos vazios.

Repetir inventário no fim e conferir objetos/versões, além de reler conteúdo da origem quando necessário para comprovar a cópia. Planejar a segunda passagem na franquia. Logs de acesso ou campos geridos como `last_accessed_at` podem precisar de classificação própria no ensaio; não descartar diferenças de identidade, versão ou conteúdo. Download incompleto, objeto ausente, mudança concorrente ou permissão insuficiente bloqueia a aquisição completa.

### 5. Verificar aquisição e arquivo criptografado

Comparar 100% dos nomes, quantidades, tamanhos e hashes com os inventários/bytes adquiridos. Conferir SHA-256 do dump, roles, metadados e manifestos; executar `pg_restore --list` privadamente para verificar leitura do archive, sem confundir TOC legível com restauração concluída. Testar leitura/descriptografia do arquivo criptografado em nova sessão e comparar todos os artefatos extraídos. Se houver segunda mídia no futuro, repetir a verificação nela; isso não é condição obrigatória na estratégia atual.

O novo verificador `scripts/backup/verify-storage-copy.mjs` é exclusivamente local, recusa o próprio repositório e não mostra dados individuais. O [contrato e uso](supabase/original/backup/README.md) explicam seu manifesto. Ele detecta corrupção, omissões por contagem, arquivos extras, colisões e diferenças entre duas cópias locais. Nunca define `restoreVerified` ou `storageBackupVerified` como verdadeiro: não comprova que o manifesto representou toda a origem, criptografia, recuperação do banco ou funcionamento do serviço.

O verificador anterior `scripts/verify-backup.mjs` continua sendo apenas checksum/tamanho de arquivo. Seu recibo em `.secrets` não é o backup nem prova de recuperação.

### 6. Restaurar em laboratório completamente isolado

Nova aprovação: destino, uso dos dados reais protegidos nele, firewall, importação, credenciais de laboratório e testes. Fazer downloads de ferramentas/imagens compatíveis **antes** de importar dados. Depois, egress negado na VM/host e no tráfego encaminhado dos containers, acesso somente por loopback/estação autorizada, sem DNS/proxy que alcance produção. Bloqueio de saída inclui banco, SMTP/SMS/OAuth, webhooks, pg_net, cron, FDW/subscriptions, Edge Functions e telemetria.

Retirar credenciais da origem do ambiente de restauração; usar novos JWT/API secrets locais, nenhum email para pessoas reais e nenhum pipeline GitHub/Netlify/deploy automático. Manter serviços que possam executar jobs/triggers/migrations de inicialização parados até revisar o import. Um rótulo de serviço `portaria_restore_lab` não prova isolamento: verificar host/IP/porta/instância efetiva. A cópia é temporária de recuperação, não um DEV permanente aprovado.

Preservar o mestre e revisar TOC/roles/SQL derivados para compatibilidade com o Supabase alvo. Não importar cegamente definições de schemas gerenciados já presentes nem remover owners/grants com regex indiscriminada; isso pode mudar SECURITY DEFINER/RLS. Usar fail-fast/exit-on-error; se houver erro, não aceitar restauração parcial. Tratamento de triggers, réplica e constraints é restrito ao alvo e exige validação posterior. [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).

Auth deve preservar usuários, IDs, vínculos/identidades e material restaurável. JWT de laboratório deve ser distinto: tokens da origem não devem funcionar nele. Não redefinir senhas ou testar login de pessoas reais; criar contas fictícias somente após a prova de preservação. [Migração Auth](https://supabase.com/kb/troubleshooting/migrating-auth-users-between-projects).

Dados criptografados podem depender de chaves não contidas no dump. Verificar Vault, criptografia de colunas e Auth/MFA em revisão privada; se utilizados, aprovar custódia/método de recuperação das chaves correspondentes sem exibi-las. Chave raiz inacessível ou decriptação não ensaiada bloqueia a alegação de recuperação integral. Não confundir JWT, senha do banco e chave de criptografia. [Portabilidade do Vault](https://supabase.com/docs/guides/database/vault).

Restaurar arquivos pelo protocolo S3/Storage API do alvo. Copiar downloads diretamente para `volumes/storage` não reconstrói seu layout interno corretamente. Conferir metadados antes/depois: upload pode alterar IDs, versão, timestamps ou propriedade; medir, não presumir preservação. Não usar DML em tabelas gerenciadas na origem para corrigir a cópia. Diferenças gerenciadas aceitáveis precisam de justificativa e aprovação explícita; diferenças em conteúdo, bucket/caminho ou vínculos bloqueiam o ensaio. [Cópia de Storage para self-hosted](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3).

### 7. Provar restauração antes de migrar

Recalcular 04 contra o baseline T0: mesmos dez totais e digests dos campos originais, IDs, relacionamentos e documentos. Confirmar histórico das 21 migrations e valores de sequências, DDL/índices/constraints, validade efetiva de FKs, funções/triggers, owners/grants/default privileges, Auth e publicações. Configurações deliberadamente diferentes de isolamento ficam em ledger privado; não devem esconder dados omitidos.

Reler **100% dos objetos pelo Storage do laboratório**, guardar um novo conjunto local privado e comparar nomes, bytes, hashes e metadados com a aquisição. Abrir amostras privadamente complementa essa prova, mas não a substitui. Não salvar documentos pessoais em fixtures, screenshots, trace, vídeo, dumps do console ou relatórios. Preservar owner nulo; não atribuir todos os documentos ao operador.

Se o protocolo gerar metadados diferentes e não houver mecanismo compatível para preservar o campo necessário, o resultado será **restauração parcial / decisão pendente**, não sucesso integral. O raw dump/manifesto da origem permanece intacto para investigação.

### 8. Ensaiar os seis candidatos na cópia

Antes: imagem/snapshot local recuperável da cópia recém-validada. Renderizar SQLs **exclusivos do laboratório**, com ref sintético válido de 20 caracteres, fingerprint da estrutura restaurada e recibo do ensaio. Não reutilizar liberação do original ou `original:authorize-write`. Registrar hashes de cada template e dos SQLs renderizados; nenhum hash foi aprovado para produção.

| Ordem | Ensaio / aceite no laboratório |
|---|---|
| 001 → 002 | Fundação/perfis/permissões; confirmar histórico e hashes preservados. Nenhuma autoria antiga preenchida |
| Antes de 003 | Criar `portaria-evidence` privado no alvo, 10 MiB, JPEG/PNG/WebP; ajustar privacidade dos buckets legados somente na cópia aprovada |
| 003 → 004 | Operações, evidências e arquivos privados; conferir restrições cumulativas, caminhos legados e grants |
| Antes de 005 | Criar `portaria-parcels` privado no alvo com o mesmo limite/MIME |
| 005 e postflight 05 | Verificar encomendas/referências no estágio de contrato 3 |
| 006 e postflight 06 | Contrato 4, presença física independente e autoria/Timeline; preservar critério antigo |
| Antes de fixtures | Repetir 04 e os checks de integridade/Storage/02; os registros originais precisam continuar iguais |
| Testes de serviço | JWTs fictícios admin/porteiro/inativo/sem perfil/anônimo; leitura/negação, assinaturas, seis fotos, visitantes, encomendas/retirada concorrente, conferência sem mudar flags, Timeline e Realtime de inspeções |

Não restaurar banco vazio via `supabase/dev`, não executar `supabase/database.sql` e não reaplicar/reparar o histórico. Aplicar somente os seis candidatos após confronto estrutural. Conservar as 65 URLs/caminhos e os 17 estados; fixtures são novas entidades fictícias separadas, sem editar registros originais. Após fixtures, hashes globais mudam legitimamente: validar originais por seu conjunto de IDs privado ou repetir em outra cópia, não exigir igualdade cega do total com fixtures incluídas.

**Duas incompatibilidades locais a resolver antes de declarar integração completa:**

1. `src/lib/environment.ts` fixa endpoints HTTPS `*.supabase.co`; o perfil atual não admite um Supabase local. Preparar futuramente um perfil/harness de ensaio com destino local estrito e identidade própria, mantendo bloqueio de produção. Não remover validações nem alterar o arquivo de destino original para contornar isso.
2. `assertPrivateFileUrl` em `src/lib/environment.ts` ainda não inclui `portaria-parcels`, enquanto `logisticsService.photo` pede esse bucket. A visualização remota da foto deve ser corrigida/testada antes da implantação. A demonstração em memória não detecta esse bloqueio. Nenhum código funcional ou proteção foi alterado nesta revisão.

SQL/PGlite e navegador demo continuam úteis, mas não substituem testes HTTP reais de Auth/Storage/PostgREST na cópia. Não repetir browser traces/screenshots com dados restaurados; testar dados fictícios e guardar somente resultados agregados. Medir tempo de recuperação, permissões gerenciadas, concorrência e funcionamento das integrações necessárias sem alcançar a origem.

### 9. Aprovar implantação e recuperação futura

O relatório final do ensaio deve conter: escopo coberto/lacunas, contagens, hashes, metadados divergentes/decisões, testes por perfil, falhas zero ou justificadas, RTO medido, RPO e identificação privada dos artefatos. Apenas após validação humana dessas evidências preencher recibos de restauração/Storage e aprovar os SQLs finais do **original**. Um checksum ou booleano preenchido manualmente não é prova.

Fazer nova aquisição T0 imediatamente antes da futura implantação se a anterior envelheceu ou houve qualquer escrita. Aprovação do laboratório não autoriza operação na origem, alteração de Auth/Storage/RLS nem publicação. Após a implantação, backups passam a cobrir também `portaria`, seus eventos e os seis buckets existentes naquele estágio, além dos quatro originais; não manter escopo antigo congelado.

Se falhar antes de COMMIT de um lote, parar e confirmar rollback. Depois de COMMIT, manter manutenção e priorizar correção incremental sem apagar históricos/arquivos. Preservar evidência do estado da falha antes de qualquer recuperação. Backup próprio Free não fornece PITR: sem outra captura, seu RPO é a última aquisição comprovada. Escritas após T0 exigem exportação/reconciliação privada por IDs e arquivos antes de qualquer retorno aos dados anteriores.

Restauração sobre o original é outra operação, potencialmente destrutiva e sujeita a limitações gerenciadas: não está preparada como comando automático neste plano. Exige plano de restore realmente ensaiado, correção de grants/configuração do painel/Storage e autorização explícita. Não reabrir buckets/RLS para fazer frontend antigo voltar; não voltar frontend de contrato 4 a um banco incompatível. Se não houver retorno compatível comprovado, manter indisponibilidade até solução segura.

## Checklist desta entrega

- [x] Quatro auditorias locais e seis candidatos revisados; novo inventário de documentos incorporado sem exibir dados individuais.
- [x] Caminho Free sem backups gerenciados definido, com alternativas e limites de cobertura.
- [x] SQLs read-only de capacidades e manifesto privado preparados; modelos de aquisição/restauração bloqueados.
- [x] Verificador de bytes/metadados exclusivamente local preparado, sem liberar recibos automaticamente.
- [x] Testes fictícios dos verificadores e dos dois SQLs: **10 aprovados**. Nenhuma exportação real.
- [x] Lint dos arquivos novos e TypeScript aprovados; os dois modelos PowerShell têm sintaxe válida e somente `throw` como instrução executável. Diff conferido respeitando CRLF.
- [x] Hashes dos seis candidatos comparados à revisão local anterior: todos iguais. Não houve alteração das migrations ou da configuração/credenciais do aplicativo.
- [x] Estação Windows consultada e estrutura de pastas vazias/ACL criada e verificada; decisão de cópia única com risco registrada.
- [ ] Aprovar ferramentas, criptografia e laboratório local. Segunda mídia fica como melhoria futura, sem bloquear o plano atual.
- [ ] Aprovar credenciais e futura janela/controles de quiescência; confirmar privilégios e franquias.
- [ ] Preparar/ensaiar coletor S3/API e empacotador reversível, sem alterar a origem.
- [ ] Adquirir banco/arquivos/configuração e comprovar cobertura/checksums/descriptografia.
- [ ] Restaurar em isolamento e validar 100% dos arquivos, metadados, Auth e vínculos.
- [ ] Ensaiar seis migrations, postflights e serviços; resolver os dois bloqueios locais de integração.
- [ ] Aprovar recuperação do original, SQLs finais e implantação. **Nenhuma dessas execuções foi iniciada.**
