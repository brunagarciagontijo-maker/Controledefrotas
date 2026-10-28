# Backup e restauração verificáveis — original

**Runbook histórico, suspenso:** o plano anterior de backup próprio no Free foi dispensado pelo usuário. Não houve aquisição/restauração e não será retomado automaticamente. Seguir [ORIGINAL_SIMPLIFIED_DEPLOY.md](ORIGINAL_SIMPLIFIED_DEPLOY.md); os métodos abaixo ficam apenas para referência futura.

**Decisão posterior vigente:** usuário dispensou backup completo e laboratório e suspendeu instalações. O plano atual é [ORIGINAL_SIMPLIFIED_DEPLOY.md](ORIGINAL_SIMPLIFIED_DEPLOY.md), com dispensa de recuperação expressa, riscos e autorizações separadas. Este runbook e o diagnóstico da estação abaixo são referência histórica; não iniciar instalação/aquisição/ensaio por continuidade e não exigir comprovante de backup fictício.

Procedimento para execução futura pelo usuário/administrador após aprovação específica. Nenhum comando de backup, download de documentos, criação de recurso, restauração ou migration é executado por este documento. Instalação/WSL/configuração local e aquisição remota exigem aprovações distintas; nenhuma é autorizada implicitamente pelo plano.

## Escolha do método no painel

No projeto original conferido, abrir **Database > Backups** e verificar: plano, estado/horário do último backup concluído, retenção, PITR habilitado ou não e opção de restauração para outro destino. Não clicar em Restore, habilitar PITR, alterar plano ou redefinir senha nesta conferência. Registrar somente essas informações e uma estimativa de tamanho/custo, sem URL de conexão, senha ou chaves.

Backups automáticos/retenção dependem do plano; podem ser físicos e não baixáveis. O backup do banco guarda metadados Storage, não os arquivos binários, e não inclui senhas de papéis customizados. Conferir as opções atuais na [documentação de backups Supabase](https://supabase.com/docs/guides/platform/backups); não presumir que um botão de download esteja disponível neste projeto.

| Situação confirmada | Caminho proposto, condicionado a aprovação |
|---|---|
| Backup nativo recente e restauração para novo projeto disponíveis | Preferir mecanismo nativo para ensaio em destino privado isolado, mais cópia independente dos arquivos Storage. Conferir limitações, prazo e custo antes de criar o destino |
| Sem backup utilizável/exportável, ou necessidade de cópia lógica independente | Administrador em estação/serviço seguro com PostgreSQL compatível já disponível prepara exportação lógica consistente e ensaia a restauração. Não instalar ferramentas neste computador nem passar senha na linha de comando/chat |
| Não há mecanismo de restauração verificável disponível | Parar antes de migrations. Aprovar alternativa de infraestrutura/custo ou suporte especializado; tamanho pequeno e ausência temporária de usuários não substituem backup |

O destino temporário serve para provar recuperação; não muda a estratégia atual para um DEV permanente. Criação, dados pessoais nesse destino, responsáveis, região, cobrança, prazo de retenção e descarte precisam ser aprovados. Restaurar para novo projeto não recria automaticamente todas as configurações/serviços: conferir [limitações da restauração para novo projeto](https://supabase.com/docs/guides/platform/clone-project).

## Conteúdo obrigatório e proteção

| Pacote | Conteúdo a conferir privadamente |
|---|---|
| Banco | Dez tabelas públicas, todos os registros/IDs/vínculos, constraints, índices, defaults, sequências e seus valores; funções, triggers, policies, grants, roles customizadas sem divulgar senhas; Auth/identidades, customizações de Auth/Storage e ledger das 21 migrations. Incluir outros schemas relevantes encontrados, sem restaurar definições gerenciadas cegamente |
| Storage | Bytes de **todos** os objetos dos quatro buckets existentes, inclusive arquivos sem referência atual; nomes/caminhos, IDs/metadados/propriedade disponíveis e configuração de cada bucket. Não limitar a cópia às 65 URLs ou aos arquivos que aparecem na interface |
| Configuração | Conferência privada de Auth/providers/redirects, SMTP, hooks, funções, jobs, webhooks, integrações, publicação e ambiente. Registrar no relatório apenas cobertura/pendências; não inserir segredos no repositório |
| Evidência | Identificação privada do projeto/data UTC/método e versão das ferramentas, escopo e exclusões, resultado da exportação, tamanho/SHA-256 dos artefatos, manifesto dos arquivos, baseline agregado e comprovantes do ensaio |

Backups contêm dados pessoais e, possivelmente, material de autenticação. Guardar criptografados, com acesso restrito e chave de recuperação protegida separadamente, **fora deste repositório e de qualquer pasta sincronizada**. Usar retenção aprovada. Segunda cópia independente fica como melhoria futura, sem bloquear a estratégia atual de cópia única com risco registrado. `.secrets` e `.gitignore` não protegem contra sincronização/compartilhamento. Não abrir dumps em terminal compartilhado, não publicar logs de linhas/URLs e não criar fixtures a partir deles.

## Aquisição consistente — operação futura

1. Aprovar responsável, método, orçamento, local protegido e janela. Credenciais são fornecidas fora do chat, em gerenciador/sessão segura; não redefinir credenciais por conveniência. Um usuário de banco com privilégios insuficientes pode omitir schemas/roles; conferir o escopo efetivo.
2. Suspender autorizadamente todas as origens de escrita: frontend antigo, integrações, jobs, importações, APIs e operações administrativas. Não presumir isolamento por estarem sem usuários. Isso coordena banco e arquivos, que não têm snapshot atômico conjunto neste procedimento.
3. Executar inventário e contagens finais; executar `04_preservation_readonly.sql` e guardar os dez totais/digests agregados em local privado. O baseline inclui URLs, IDs e vínculos no hash, sem exportá-los individualmente. Rodar com as mesmas configurações UTC e sem novas operações antes/depois.
4. Obter snapshot/backup coerente. Se lógico, o administrador deve validar versão compatível de `pg_dump`, formato, acesso a Auth/histórico/customizações e restauração dos papéis/owners apropriados ao Supabase. CSVs por tabela ou três exports independentes sem janela consistente não bastam. Não executar comandos de dump com conexão/senha literal em logs/histórico.
5. Copiar os arquivos via mecanismo Storage/API/S3 suportado, com leitura da origem e paginação/recursão completas. Não executar sync com remoção, mover objetos, sobrescrever origem ou usar DML direto nas tabelas gerenciadas. As credenciais necessárias ficam só na sessão do administrador; não no frontend.
6. Criar manifesto privado por objeto com bucket/caminho, bytes, SHA-256 do conteúdo e metadados necessários. Incluir objetos sem owner; ausência de owner não prova ausência de controle nem autoriza mudar propriedade. Verificar totais e falhas por bucket. `metadata.size`, ETag ou uma listagem bem-sucedida não substituem checksum dos bytes copiados.
7. Confirmar estabilidade entre o inventário de objetos no início e no fim. Arquivo faltante, paginação incompleta, erro de download ou escrita concorrente impede declarar cobertura completa. Refazer a aquisição sob janela coerente; não ignorar falhas silenciosamente.
8. Calcular checksums dos artefatos e testar leitura/descriptografia da cópia protegida. O comando local `npm run backup:verify -- --file CAMINHO_PRIVADO` calcula somente tamanho/hash de um arquivo fora do repositório; não realiza backup, não prova cobertura e mantém `restoreVerified`/`storageBackupVerified` falsos. Não executado sobre dados reais nesta revisão.

Para exportação/restauração lógica, adaptar privadamente o [procedimento oficial](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Customizações dos schemas gerenciados precisam de cobertura própria; dados criptografados podem depender da chave raiz do projeto. Não copiar/redefinir chaves nesta fase nem presumir que dumps restauram configuração externa. A estação utilizada e qualquer ferramenta adicional também exigem autorização se ainda não estiverem disponíveis.

## Ensaio de restauração — somente destino aprovado

1. Conferir o identificador do destino, que deve ser diferente do original. Manter o frontend original bloqueado. Antes de importar, impedir egress/execução de integrações, envios, jobs e webhooks; não expor a cópia restaurada nem permitir login/envio automático para usuários reais.
2. Restaurar banco pelo método aprovado e apropriado ao serviço gerenciado. Não usar `supabase/dev`, `supabase/database.sql`, replay das 21 migrations ou reparação do ledger. Triggers, papéis e criptografia exigem tratamento compatível pelo administrador; não desabilitar proteções do original para fazer o ensaio funcionar.
3. Recuperar arquivos no destino pelos mecanismos suportados, preservando bucket/caminho e bytes. Conferir também IDs/metadados/proprietários. Uma simples reupload pode mudar esses campos: não declarar restauração integral apenas porque o arquivo abre. Se o mecanismo não preservá-los, registrar a diferença e obter decisão explícita sobre adaptação; nenhuma alteração correspondente na origem é autorizada.
4. Recalcular `04_preservation_readonly.sql`: contagens **e** digests dos campos originais devem coincidir nas dez tabelas. Verificar FKs/constraints/índices, sequências, histórico de migrations, Auth e policies. Os totais anteriores 185/144/90 são referência; usar o baseline final da janela.
5. Comparar 100% dos arquivos recuperados com o manifesto: quantidade, caminhos, bytes e SHA-256, inclusive objetos sem referência. Abertura privada de amostras complementa, não substitui essa comparação. Não enviar amostras/documentos para o chat ou relatórios.
6. Após aprovação específica do ensaio, testar os candidatos incrementais e as operações Storage no destino. Repetir hashes antes de permitir operações funcionais. Confirmar que os 17 estados não mudaram e as URLs antigas foram mantidas. Executar testes de JWT/Storage/Realtime aprovados com contas de teste autorizadas e dados fictícios; registrar separadamente as novas escritas.
7. Registrar tempo de recuperação, erros, cobertura e limitações, hash dos artefatos/manifestos e resultado assinado pelo responsável. Definir RPO (ponto dos dados a recuperar) e RTO (tempo aceitável de parada). Preservar comprovação privada; marcar os recibos de liberação somente com essas evidências.
8. Não limpar o destino, apagar backup ou encerrar recursos automaticamente. Descarte/retenção/custos são uma operação posterior aprovada, com preservação da cópia e das evidências necessárias.

## Critério de liberação e falha

Sem diferença injustificada nos dados/arquivos, recuperação ensaiada e cobertura de Auth/Storage/configuração conferida, o backup pode ser apresentado para aprovação do SQL exato. Checkbox ou SHA-256 de um arquivo isolado não é prova suficiente.

Falha no ensaio bloqueia a janela do original. Se uma implantação futura falhar antes do COMMIT de um lote, parar e desfazer somente a transação desse lote. Depois do COMMIT, manter manutenção e avaliar correção incremental. Restauração do original é operação destrutiva separada: depende de aprovação, conciliação das escritas posteriores e recuperação coerente dos arquivos. Nunca presumir que restaurar apenas o banco recupera documentos apagados ou desfaz mudanças do painel.
