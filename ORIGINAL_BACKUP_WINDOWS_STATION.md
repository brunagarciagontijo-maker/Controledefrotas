# Estação Windows — backup próprio e laboratório local

> **PLANO SUSPENSO:** o usuário dispensou backup completo/laboratório e suspendeu instalações WSL/Docker/PostgreSQL CLI/ferramentas de backup. As pastas vazias criadas ficam preservadas, sem dados. Não executar os comandos de instalação/criação abaixo por continuidade do plano anterior. Seguir [ORIGINAL_SIMPLIFIED_DEPLOY.md](ORIGINAL_SIMPLIFIED_DEPLOY.md); este diagnóstico permanece apenas como referência.

Revisão de 27/10/2026, branch `desenvolvimento`. Este é o complemento operacional vigente de [ORIGINAL_BACKUP_FREE_PLAN.md](ORIGINAL_BACKUP_FREE_PLAN.md) e [ORIGINAL_BACKUP_RUNBOOK.md](ORIGINAL_BACKUP_RUNBOOK.md). O usuário escolheu este computador, uma única cópia local criptografada e restauração isolada; não dispõe de outro dispositivo. **Segunda cópia independente é recomendação futura, não condição obrigatória agora.** A aprovação para aquisição, instalação, configuração e ensaio continua separada.

## Diagnóstico confirmado

Consultas locais de hardware, registro, executáveis, instalações registradas, serviços e WSL; nenhuma conexão ao Supabase. Documentação pública dos fornecedores foi consultada para instalações/requisitos. Não foram baixados instaladores/imagens nem iniciados serviços.

| Item | Resultado | Avaliação / limite |
|---|---|---|
| Windows | Windows 11 Home Single Language, 25H2, build 26200.9711, 64 bits | Usar containers Linux via WSL 2; não planejar Hyper-V/containers Windows como alternativa pronta nesta edição |
| CPU | 10 núcleos / 12 processadores lógicos, 64 bits | Capacidade nominal suficiente; modelo/identificadores não são necessários no relatório |
| Virtualização | `HypervisorPresent=true`; flags CIM de firmware/SLAT/VM monitor retornaram false | Resultado inconclusivo para disponibilidade desses recursos ao WSL. Hipervisor ativo pode mascarar flags; não concluir que BIOS está desativada, nem alterar BIOS. Confirmar WSL 2 operacional após instalação autorizada |
| RAM | 15,69 GiB utilizáveis; 4,00 GiB disponíveis na amostra; cerca de 11,69 GiB em uso | Laboratório viável com ajustes, sem garantia de estabilidade na carga atual. Fechar aplicações manualmente e medir de novo; buscar pelo menos 8 GiB disponíveis antes de iniciar o conjunto |
| Disco local | C:, NTFS, 455,45 GiB totais, 283,38 GiB livres | Folga para laboratório e backup estimados; SSD/estado de saúde não foram confirmados |
| WSL | `--version`, `--status` e `--list --verbose` informam não instalado | Nada instalado/atualizado/iniciado nesta revisão |
| Serviços | Docker/WSL/vmcompute não encontrados nos nomes consultados; LanmanServer em execução/automático | Isso não substitui instalação/validação do runtime |
| Permissões | Sessão normal sem token administrativo | Habilitar WSL pode exigir administrador/reinício. Autorização de leitura fora da sandbox não equivale a habilitar elevação/instalação |
| Diretório do projeto | Caminho corporativo; OneDrive em execução | Não guardar backups em `.secrets`, no projeto, Desktop ou Documentos sincronizados. Não presumir sincronização desativada |

As consultas CIM foram negadas na sandbox e concluídas após autorização para leitura fora dela. O WinGet também só respondeu fora da sandbox. Não houve erro 1909 nesta rodada. RAM é uma fotografia, não reserva permanente. Não foram verificadas políticas corporativas de instalação, antivírus/firewall, licença Docker ou acesso futuro ao registro de imagens.

**Conclusão:** a estação é **viável com ajustes**, mas o laboratório ainda não está pronto. Disco e RAM total são suficientes em princípio; faltam ferramentas, WSL 2, confirmação operacional da virtualização, liberação de RAM e isolamento comprovado. O backup não existe e não é validado.

## Ferramentas

| Ferramenta | Confirmado localmente | Ação proposta, ainda não executada |
|---|---|---|
| Node / npm | 24.11.1 / 11.6.2 | Reutilizar; não instalar SDK ou dependências automaticamente |
| Git | 2.52.0.windows.1 | Nenhuma operação de publicação |
| PowerShell | 5.1.26100.9711 | Adequado aos modelos; evitar pipeline binário nesta versão |
| WinGet / Chocolatey | 1.29.380 / 2.5.1 | Priorizar fontes oficiais/WinGet com publisher e hash conferidos; não é necessário instalar outro gerenciador |
| `pg_dump`, `pg_restore`, `psql`, `pg_dumpall` | Ausentes do PATH; diretório PostgreSQL habitual ausente | Clientes PostgreSQL **17**, último minor disponível na data de aquisição, x64. Nenhum servidor Windows necessário |
| Docker Desktop / CLI | Ausentes do PATH, locais usuais e instalações registradas consultadas | Escolher runtime após conferir licença; não instalado |
| Supabase CLI | Ausente do PATH e local Scoop usual | Opcional com Compose oficial; útil se o laboratório usar CLI. Não instalar via dependência do aplicativo |
| rclone / AWS CLI | Ausentes do PATH e locais usuais consultados | Opcionais; não instalar os dois. API/SDK com coletor restrito é suficiente após preparo/testes |
| HTTP/API | curl 8.21.0; `Invoke-WebRequest` / `Invoke-RestMethod`; Node com `fetch` | São capacidades locais, não teste de acesso remoto nem coletor Storage completo |
| 7-Zip / age / gpg | Ausentes do PATH; 7-Zip também ausente no caminho e registro consultados | Priorizar 7-Zip oficial para um arquivo 7z AES-256 com nomes criptografados |

Não foi feita varredura exaustiva de todos os discos/pastas portáteis: “não encontrado” não prova ausência absoluta. Nenhuma versão ausente foi executada por `npx` ou download implícito.

## Dimensionamento e isolamento

O Supabase publica para o conjunto self-hosted mínimo de 4 GB RAM / 2 núcleos / 40 GB SSD e recomenda 8 GB+ / 4 núcleos / 80 GB+; Docker Desktop informa 8 GB de RAM de sistema e WSL 2 compatível. Reservar **80 GiB de disco como orçamento inicial do laboratório**, mais staging/arquivo/restauração; há folga atual para esse orçamento. Isso é planejamento, não prealocação nem medição de consumo. [Supabase Docker](https://supabase.com/docs/guides/self-hosting/docker), [Docker no Windows](https://docs.docker.com/desktop/setup/install/windows-install/).

- Storage atual: 377.593.104 bytes informados, aproximadamente 360,10 MiB. Staging + arquivo criptografado + arquivos restaurados/relidos podem consumir pelo menos quatro vezes os bytes, sem presumir compressão de fotos. Banco, índices, WAL, imagens, volumes e logs somam espaço adicional. O tamanho real do banco aguarda a futura consulta autorizada 07.
- Para o laboratório, planejar inicialmente 6–8 GiB para Linux/containers, quatro CPUs, com reserva para Windows. É orçamento ajustável após medição, não configuração aplicada. Não iniciar builds, navegador pesado e stack completo simultaneamente enquanto a RAM estiver baixa. Não encerrar processos automaticamente nem mudar `.wslconfig` agora.
- Baixar imagens/ferramentas oficiais fixadas por versão/digest e testar somente dados fictícios **antes** de introduzir dados restaurados. Verificar PostgreSQL 17 e extensões/serviços compatíveis; major 17 sozinho não garante compatibilidade Supabase.
- Laboratório em diretório próprio fora do repositório, com banco, chaves/JWT e credenciais próprios. Não copiar credenciais de origem para `.env`/containers/laboratório. Não executar `supabase login`, `link`, `db pull`, `db push`, `db reset --linked` ou os scripts de liberação de escrita do original.
- **Não executar `supabase start` neste repositório:** o CLI pode reaplicar as 21 migrations antigas sobre um banco vazio. Usar workspace novo, sem migrations/seed da aplicação, ou Compose oficial revisado; importar primeiro a cópia, depois ensaiar apenas 001–006.
- Bind de portas explicitamente em `127.0.0.1`, sem exposição na LAN; redes internas, nenhum endpoint público. Antes de dados reais, testar bloqueio de saída de containers **e host/WSL**, inclusive acesso a host, proxies, DNS e tráfego encaminhado. `internal:true`/loopback sozinhos não são comprovação de ausência de egress.
- Sem SMTP/SMS/OAuth externo, webhooks, cron, pg_net, FDW/subscriptions ou automações ativadas. Evitar telemetria e saída por ferramentas de administração. Um ensaio offline com a rede física desconectada, após preparar imagens, é opção simples adicional; a eficácia deve ser verificada também com adaptadores/VPNs existentes.
- PostgreSQL puro é fallback para testar dump/DDL/FKs, mas não valida Auth, Storage, PostgREST, JWT, RLS efetiva via API ou Realtime. Não declarar recuperação completa só com PostgreSQL/PGlite.

## Comandos de instalação preparados — NÃO executados

Conferir novamente versões, publisher, assinatura/hash, permissões corporativas e escopo **na instalação aprovada**. Evitar scripts remotos enviados diretamente a `iex`, execução silenciosa com aceite automático de licenças ou comandos que instalem servidor/serviço sem necessidade.

### 1. Clientes PostgreSQL 17 sem servidor

Preferência: ZIP x64 de binários na página oficial PostgreSQL/EDB, conferido e extraído em `tools\postgresql17`, preservando DLLs/dependências da distribuição. ZIP pode conter servidor; não executar `initdb`, `pg_ctl` ou registrar serviço. Se faltar runtime Visual C++, apresentar a dependência para aprovação, sem instalar automaticamente. [Windows PostgreSQL](https://www.postgresql.org/download/windows/).

Alternativa oficial com instalador EDB já baixado/conferido: executar **somente o comando revisado para a versão escolhida**, em modo interativo, desabilitando servidor/pgAdmin/StackBuilder. `--help` deve confirmar as opções antes da instalação:

```powershell
# Exemplo com nome substituto; exige aprovação. Não fornecer senha.
& '.\postgresql-17-VERSAO-windows-x64.exe' --mode win32 --enable-components commandlinetools --disable-components server,pgAdmin,stackbuilder
```

Depois, consultar versões por caminho absoluto; PATH global permanece desnecessário. Não executar `psql -U postgres` como teste, pois tentaria conexão. [Parâmetros EDB](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/).

```powershell
# Após instalação/extração aprovada, ajustar o diretório dos binários:
$pgBin = Join-Path $env:LOCALAPPDATA 'SistemaPortariaBackup\tools\postgresql17\bin'
& (Join-Path $pgBin 'pg_dump.exe') --version
& (Join-Path $pgBin 'pg_restore.exe') --version
& (Join-Path $pgBin 'psql.exe') --version
& (Join-Path $pgBin 'pg_dumpall.exe') --version
```

### 2. Criptografia

7-Zip oficial ou pacote identificado no repositório Microsoft WinGet. A instalação pode exigir UAC conforme pacote/escopo; não garantir instalação sem administrador. [7-Zip](https://7-zip.org/), [manifesto WinGet](https://github.com/microsoft/winget-pkgs/tree/master/manifests/7/7zip/7zip).

```powershell
# Somente após aprovação; mostrar metadados antes de instalar:
winget show --id 7zip.7zip --exact --source winget
winget install --id 7zip.7zip --exact --source winget --interactive
```

### 3. Runtime de containers

**Decisão de licença pendente:** Docker Desktop exige assinatura no uso empresarial que excede os limites publicados de porte/faturamento. A elegibilidade da empresa não foi verificada e não deve ser inferida do nome. Não aceitar licença automaticamente. Se elegível/contratada, usar instalador oficial interativo (preferir per-user quando compatível) ou WinGet revisado. [Instalação e termos](https://docs.docker.com/desktop/setup/install/windows-install/), [pacote Microsoft](https://github.com/microsoft/winget-pkgs/tree/master/manifests/d/Docker/DockerDesktop).

```powershell
# WSL ausente: aprovação de recurso Windows, administrador e possível reinício.
# Não instala Ubuntu; Docker Desktop não exige uma distribuição de usuário.
wsl --install --no-distribution

# Após reinício autorizado e conferência do WSL/licença, instalação interativa:
winget show --id Docker.DockerDesktop --exact --source winget
winget install --id Docker.DockerDesktop --exact --source winget --interactive
```

Não iniciar Docker automaticamente ao fim; inicialização/configuração/teste local terão autorização própria. [Comandos Microsoft WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands).

Se Docker Desktop não for elegível sem custo, alternativa: WSL 2 + Ubuntu + Docker Engine/Compose seguindo repositório oficial Ubuntu. Requer mais configuração e manutenção, inclusive daemon/permissões e rede; não equivale a `winget install Docker.DockerDesktop`. Não recomendar mudar edição do Windows ou contratar licença sem decisão. O procedimento Linux deve ser fixado para a distribuição escolhida antes de executar qualquer `apt`; não foi preparado como instalador automático. [Docker Engine Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

### 4. Opcionais

- Supabase CLI: binário Windows x64 em release oficial fixada, conferido por checksum disponível, extraído privadamente; ou Scoop **se já houver Scoop aprovado/instalado**. Não instalar Scoop só para isto, não usar `npm install -g supabase`, não alterar `package.json`. [CLI oficial](https://github.com/supabase/cli#install-the-cli).

```powershell
# Alternativa apenas para estação com Scoop; não executar neste estado:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

- rclone: ZIP Windows AMD64 e checksum do site oficial, extraído em `tools`; sem instalação de serviço. Não configurado nem necessário se for escolhido coletor API. AWS CLI não é pré-requisito adicional. [Download oficial](https://rclone.org/downloads/).

## Estrutura privada e cópia única

Destino proposto: `%LOCALAPPDATA%\SistemaPortariaBackup`, fora do caminho corporativo. O preparador [prepare-windows-station.ps1](scripts/backup/prepare-windows-station.ps1) **por padrão apenas imprime o plano**. `-CreatePrivateDirectories`, após autorização, cria somente raiz nova e pastas vazias, com ACL de usuário atual, SYSTEM e administradores, sem mudar ACL do perfil/Windows, instalar, criptografar ou tocar arquivos existentes. Recusa raiz existente, rede/mapeamento, junctions e sincronizações reconhecidas. Em erro, não remove nada e proíbe colocar dados até revisão.

```text
SistemaPortariaBackup/
  credentials/           credenciais futuras, nunca incluídas no arquivo de backup
  tools/                 ferramentas portáteis conferidas
  archives/              arquivo 7z criptografado + checksum global sem dados pessoais
  staging/
    database/            dump, roles e TOC privados
    storage/objects/     nomes locais UUID, mapa reversível no manifesto
    manifests/           inventários, baseline e metadados privados
    verification/        verificações e evidências privadas
    logs/                logs privados, sem segredos em argumentos
  lab/
    bootstrap/           configuração/containers próprios, sem migrations antigas
    evidence/            relatórios agregados do ensaio
```

**Resultado efetivo desta execução:** a criação foi autorizada pela ferramenta e concluída; raiz e 13 subpastas criadas com ACL conferida. Nenhum dado ou credencial foi colocado nelas. Não estão criptografadas; ainda não há backup. O preparador recusa recriar/alterar uma raiz existente, inclusive em `-WhatIf`; o modo sem parâmetros continua apenas informativo.

Para aquisições futuras, criar conjunto novo com identificador de execução, sem sobrescrever aquisição anterior. Não arquivar `credentials`, `tools` ou volumes vivos do laboratório como se fossem dump consistente.

```powershell
# Plano local, sem escrita:
powershell -NoProfile -File scripts/backup/prepare-windows-station.ps1
# Simulação da criação, ainda sem escrita:
powershell -NoProfile -File scripts/backup/prepare-windows-station.ps1 -CreatePrivateDirectories -WhatIf
# Criação real SOMENTE após autorização para pastas/ACL no destino externo ao repo:
powershell -NoProfile -File scripts/backup/prepare-windows-station.ps1 -CreatePrivateDirectories
```

ACL não é criptografia. A política proposta é 7z AES-256 com **criptografia dos nomes/header**, senha forte criada e guardada pelo usuário fora do chat e fora do arquivo. Não passar senha em argumentos nem variável de ambiente. Preferir a interface do 7-Zip para adicionar **somente o conjunto staging** ao arquivo novo e depois executar Testar/extração privada de conferência. [Formato/criptografia 7z](https://7-zip.org/7z.html).

Aquisição e restauração produzem dados temporários em claro no staging e nos volumes do laboratório: isso precisa de aceite explícito e ACL. BitLocker/Criptografia do dispositivo não foram verificados nem ativados. Se a exigência for criptografia também durante processamento, preparar um volume criptografado antes de adquirir dados, com autorização de configuração separada. Não apresentar arquivo 7z final como criptografia de todo o disco.

Verificar desbloqueio por nova sessão sem senha em cache e extrair em destino privado para recalcular hashes e restaurar. Só então decidir limpeza/retenção dos temporários, com aprovação; remoção comum não garante apagamento físico em SSD/VSS. Nunca incluir senhas de origem no backup por conveniência.

**Risco aceito de uma cópia:** perda/falha do computador/disco, roubo, ransomware ou perda da senha podem eliminar toda a recuperação. Duas pastas/partições/arquivo e laboratório neste C: não são cópias independentes. A chave deve ter custódia separada (por exemplo gerenciador confiável ou anotação protegida, conforme escolha do usuário). Sem outro dispositivo, o risco é registrado e não bloqueia automaticamente o plano proporcional; os requisitos de integridade/restauração continuam obrigatórios. Uma cópia externa criptografada será melhoria futura quando houver meio disponível.

## Coleta futura dos 236 objetos — sem execução

| Bucket atual | Objetos | Bytes de metadados | Visibilidade auditada |
|---|---:|---:|---|
| `access-documents` | 87 | 94.215.862 | Privado |
| `driver-cnh-documents` | 65 | 19.094.786 | Público |
| `person-documents` | 5 | 1.413.076 | Privado |
| `vehicle-operation-photos` | 79 | 262.869.380 | Público |
| Total | 236 | 377.593.104 | Nenhuma alteração autorizada |

Procedimento exato a implementar/testar **antes de autorizar a aquisição**:

1. Abrir execução privada nova; guardar baseline da janela autorizada. Conferir os quatro buckets e qualquer adicional: 236 é referência auditada, não valor fixo aceito cegamente.
2. Capturar 08 e configurações dos buckets em arquivo privado. Listar via S3/Storage API com paginação completa e comparar conjunto exato `(bucket,nome)`, versões e tamanhos. Usar backend com privilégio de leitura completo, conferido fora do chat. Nenhuma URL documental histórica será seguida.
3. Baixar com GET autenticado somente do endpoint de origem previamente aprovado, sem redirect para outro host e sem operação de escrita. Persistir cada conteúdo em arquivo UUID, sem normalizar caso, Unicode, separadores ou nomes reservados Windows. Guardar nome original, ID, owner nulo, timestamps, versão, MIME, user metadata e demais metadados disponíveis no mapa privado.
4. Calcular SHA-256 durante a transferência e reler o arquivo final para conferência; validar tamanho real e falhas. ETag não substitui SHA-256. Guardar inventário inicial/final, com retomada estritamente validada e falha fechada, sem ecoar nomes/documentos/URLs em erros. Metadados temporários de acesso podem mudar por leitura; classificar diferenças explicitamente, sem ignorar identidade/conteúdo.
5. Comparar novamente origem estável e metadados; sem janela coordenada, banco e arquivos não têm snapshot atômico. Falhas, mudanças, buckets omitidos ou paginação incompleta impedem concluir cobertura.
6. Gerar o [manifesto privado contratado](supabase/original/backup/README.md), rodar o verificador local de 100% dos bytes, criptografar/testar/decriptografar o conjunto; relatório somente com contagens/tamanhos/checksums globais.
7. Restaurar via Storage API/S3 **do laboratório**, nunca cópia bruta de arquivos para o volume. Relê-los da API local, comparar 100% dos hashes e todos os metadados necessários. Reupload pode mudar ID/owner/versão: qualquer diferença deve ser medida, explicada e aprovada, sem declarar sucesso integral indevido.

O coletor remoto ainda não está implementado; curl/Node/rclone não atendem sozinhos paginação + mapa UUID + manifesto + controles de destino. Os modelos de aquisição/restauração permanecem bloqueados. É uma dependência local a resolver/ensaiar com dados fictícios, não justificativa para rodar download agora.

## Banco, serviços gerenciados e ensaio 001–006

- Clientes PG17, conexão futura TLS `verify-full`, direta ou pooler Session, nunca Transaction. `PGSERVICEFILE`/`PGPASSFILE` privados, sem senha no chat/argumento/.env do frontend. Credencial do painel não prova leitura completa. `pg_dump -Fc` completo mantém dados/IDs/FKs/policies/funções/triggers/grants/owners/sequências e schemas alcançáveis; roles/memberships separados sem senhas. Não há dump físico/WAL/PITR garantido no Free. [Conexão Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).
- `postgres` Supabase não é superusuário irrestrito. Rever 07, permissões Auth/Storage/extensões, ledger e TOC antes de alegar cobertura; não usar flags para omitir dados silenciosamente. ZIP/CLI instalado não resolve limitações de exportação. [Papéis](https://supabase.com/docs/guides/database/postgres/roles-superuser).
- Instância Supabase local já contém schemas/papéis/objetos gerenciados; restaurar o dump inteiro sem TOC e owners revisados pode colidir. Não executar `--clean`, `--create`, repair/replay do ledger, ou ignorar erros. Guardar mestre imutável e mapa privado do que já existe, do que é importado e de exceções aprovadas. [Restore self-hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform).
- Auth inclui IDs/hash de senha/material sensível. Não usar contas reais para teste, renovar sessões ou enviar mensagens. Chaves JWT do laboratório são próprias. Vault/pgsodium/MFA ou outros dados criptografados podem depender de chaves de projeto: detectar presença/portabilidade antes de declarar cobertura completa. Configurações de painel/SMTP/providers não são recriadas só com SQL.
- API/S3 keys de backend podem ter escrita ampla/bypass RLS mesmo quando o coletor só usa leitura. Não criar/revogar credenciais ou ajustar permissões agora; remover acesso às credenciais da origem do contexto do laboratório. Os 236 owners nulos são informação preservada, não permissão pública.
- Buckets públicos e RLS permissivas auditados são estado de origem para preservar no artefato, não para expor na LAN. Laboratório é inacessível externamente e fica isolado durante importação/testes. Triggers, SECURITY DEFINER, search_path, jobs, publicações, extensões, default privileges, sequences e grants precisam de validação, não apenas contagens.

Após autorização separada do ensaio: restaurar, comparar baseline 04/01/03, dados/IDs/vínculos e os 236 arquivos da janela, guardar checkpoint local da cópia e só então ensaiar:

| Ordem no laboratório | Critério |
|---|---|
| 001 → 002 | Fundação/perfis/permissões; sem backfill de autoria histórica; originais preservados |
| Pré-003 | `portaria-evidence` privado, 10 MiB, JPEG/PNG/WebP, somente no alvo |
| 003 → 004 | Operações/evidências; privacidade dos quatro legados aprovada/configurada apenas no laboratório antes da 004; RLS/Storage cumulativos |
| Pré-005 | `portaria-parcels` privado com limite/MIME equivalente, somente no alvo |
| 005 + postflight 05 | Contrato 3, encomendas/conferência |
| 006 + postflight 06 | Contrato 4, presença física/autoria/Timeline, histórico sem sobrescrita |
| Antes de fixtures | Repetir preservação/integridade/permissões; manter 65 URLs e 17 estados legados |
| Depois | Testar Auth/RLS/Storage/concorrência/Realtime por API local com novas contas fictícias; nenhuma conta real/log de documento |

Registrar hashes dos seis templates e SQLs renderizados **para o alvo de laboratório**, com identidade/fingerprint próprios, sem habilitar `original:authorize-write`. Não desativar as pré-condições para contornar um alvo incompatível. Os hashes 001–006 não foram alterados por esta preparação. Checkpoint/laboratório e arquivo no mesmo C: não constituem segunda cópia independente.

Limitações locais já registradas no plano Free, sem alterar código funcional nesta tarefa: o validador atual aceita somente HTTPS `*.supabase.co`, exigindo harness/perfil local estrito; a allowlist de arquivos privados não contém `portaria-parcels`. Resolver/testar futuramente antes de afirmar integração completa. O ensaio local não autoriza migração original, alteração remota de buckets/RLS/Auth ou publicação.

## Checklist e próxima autorização

- [x] Hardware/Windows/WSL e ferramentas verificados por consultas locais; diagnóstico com limites explícitos.
- [x] Estrutura privada e preparador com plano/WhatIf definidos; raiz e 13 subpastas vazias criadas e ACL conferida com permissão pontual, sem código funcional alterado.
- [x] Comandos oficiais propostos, com alternativa à licença Docker Desktop.
- [x] Estratégia de uma cópia aceita; risco de perda única registrado, sem impor segundo dispositivo.
- [x] Coleta/restauração Storage e ensaio 001–006 detalhados, sem acesso remoto.
- [x] Pastas/ACL privadas criadas fora do repositório; sem dados, credenciais ou criptografia. Instalação/configuração do laboratório não iniciada.
- [ ] Aprovar/instalar clientes PG17 e 7-Zip; escolher runtime/licença; aprovar WSL e possível reinício. Nenhum instalador foi executado.
- [ ] Liberar RAM manualmente e medir de novo; configurar/iniciar laboratório vazio, testar isolamento e dados fictícios com aprovação própria.
- [ ] Preparar/testar coletor e restauração compatíveis; resolver limitações managed/criptografia/harness.
- [ ] Autorizar aquisição somente leitura, janela, credenciais externas e temporários privados em claro (ou volume criptografado).
- [ ] Adquirir, verificar, criptografar/descriptografar e **restaurar/testar** banco + arquivos. Backup permanece inválido até isso.
- [ ] Aprovar explicitamente ensaio das seis migrations na cópia isolada. Nenhuma migration foi executada nesta revisão.

Validação local desta preparação: parser PowerShell sem erros, modo padrão e `-WhatIf` não criaram a raiz antes da autorização, dez testes de backup com dados fictícios aprovados, hashes dos seis candidatos iguais à revisão anterior. Não foram repetidos build/navegador porque nenhum código funcional foi alterado; isso não valida serviços reais ou restauração.

**Próxima autorização:** instalação/preparo local das ferramentas escolhidas, após decisão de licença do runtime, incluindo eventual WSL/reinício. Ela não autoriza aquisição do Supabase nem execução de migrations; essas continuam pendentes de autorização explícita posterior.
