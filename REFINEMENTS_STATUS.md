# Refinamentos do Sistema Portaria

Implementação local na branch `desenvolvimento`, sem acesso ao Supabase original, operações remotas, aplicação de migrations, instalação, commit ou publicação. A prévia em `http://127.0.0.1:5173/` continua sendo demonstração fictícia em memória; recarregar descarta os dados simulados.

## Concluído no código

| Área | Comportamento atual |
|---|---|
| Conferência física | OK = encontrado; NOK = não encontrado. Ambos independem da expectativa e dispensam justificativa obrigatória. A observação é opcional |
| Conformidade | Esperado/encontrado e não esperado/não encontrado são conformes. As outras duas combinações destacam divergência. Expectativa desconhecida pede revisão, sem impedir registro físico |
| Integridade | Marcar presença não altera disponibilidade, não cria entrada nem modifica uma conferência anterior. Resultado registra data/hora real e usuário. Uma nova rodada preserva referências e resultados anteriores |
| Confirmação | `Carro disponível no pátio - DD/MM/AAAA HH:mm:ss` ou `Carro não localizado no pátio - DD/MM/AAAA HH:mm:ss`, usando horário do registro no fuso de São Paulo |
| Entrada pela conferência | Veículo esperado fora mostra última saída confiável quando fixada na referência. Registrar entrada reconsulta as fontes atuais e abre o formulário operacional ou legado existente. O clique não registra retorno; ausência de saída aberta, conflito ou mudança de placa bloqueia o encaminhamento com explicação |
| Veículos | Tabela no desktop e uma única lista compacta no celular, sem duplicar elementos interativos. Código, placa, veículo, responsável, situação, última movimentação e ação. Pesquisa e filtro de situação preservados |
| Encomendas | Tabela/lista com destinatário, recebimento, status, retirada/coletor e ações. Retirada abre modal compacto com nome obrigatório. Câmera/upload, privacidade, pesquisa, filtros, detalhes, CSV e proteção contra retirada duplicada preservados |
| Timeline | Veículos, pessoas, encomendas, presença física, divergências e solicitações/conclusões de inspeção. Cronologia, responsável registrado, identificação, detalhes, período, tipo, pesquisa e CSV. Exibe 100 eventos por vez com Mostrar mais |
| Gestão | Banco e Relatórios reunidos em Gestão, com Registros anteriores, Movimentações da Portaria e Indicadores. Consultas, filtros, detalhes, devolução legada, assinaturas, CSV, Excel de utilização diária, impressão e indicadores mantidos. Filtros continuam ao alternar essas seções |
| Navegação | Quatro menus: Gestão, Pátio, Veículos e Sair. Links `tab=banco`/`database` abrem consultas; `tab=relatorios`/`dashboard` abrem indicadores. `tab=registro`/`form` continuam abrindo saída no Pátio |
| Preservação | Identidade visual, responsividade, Cobli manual com duas opções, assinatura obrigatória, fotos condicionais, visitantes com câmera/documento privado, cadastros por perfil, inspeções, Auth, RLS e Storage preservados |

## Histórico e limites de interpretação

- Os 17 estados fora sem saída aberta continuam sem conciliação automática. A expectativa histórica é separada da flag atual. Ausência de evidência não vira presença presumida.
- Uma última saída nova é copiada para a referência com origem/ID e data/hora. Empates não resolvidos não são adivinhados. Referências antigas sem essa informação permanecem sem preenchimento retroativo. Entrada sempre exige saída **atualmente** aberta, mesmo quando o usuário consulta uma referência antiga.
- Conferências gravadas pelo critério anterior preservam seus campos `result`, `observed`, datas e autoria. O novo campo `meaning` identifica `compatibility_v1`; novos registros usam `physical_v2`. Exemplo: um OK anterior com `observed=false` continua armazenado como OK de compatibilidade; a interface mostra fisicamente não encontrado, explica o critério original e exporta ambos separadamente. Não há conversão em massa de OK/NOK antigos.
- Timeline e indicadores combinados reconciliam somente equivalências 1:1 entre fluxos: placa, nome do motorista, saída completa e retorno correspondente ou ausência completa de retorno. A Timeline conserva referência ao registro pareado. Ambiguidades não são suprimidas; cada origem permanece consultável. Nada é excluído ou convertido no banco.
- Datas/horários operacionais incompletos não recebem meia-noite artificial; a Timeline informa quantos eventos não puderam ser posicionados. O usuário da entrada não é presumido como usuário da saída, nem motorista/destinatário é tratado automaticamente como operador.
- Autoria nova é registrada pelo servidor. Onde a autoria antiga não existe, a interface informa ausência. Nomes antigos já armazenados em inspeções continuam sendo informação registrada, não uma verificação retroativa da identidade.
- A conferência anterior ao modelo diário continua consultável. Esse modelo não guardava snapshot de placa; a identificação exibida depende do cadastro atual. Não se fabrica o cadastro de veículos já excluídos no passado.
- A Timeline carrega fontes autorizadas e filtra localmente; Mostrar mais limita a renderização, não a consulta ao banco. Medir volume/tempo no ensaio e acrescentar paginação no servidor se o histórico crescer. Atualizar Timeline consulta mudanças de outros operadores; não foi adicionada assinatura Realtime para todos os eventos.

## Mudança de banco necessária, somente preparada

Novo candidato: `supabase/original/incremental/006_physical_checks_timeline.sql`, depois de **001 → 002 → 003 → 004 → 005**. As migrations anteriores e as 21 históricas não foram reescritas nesta rodada.

006 adiciona `meaning` às conferências e `last_departure` aos itens de referência, ajusta as RPCs físicas e cria `portaria.operation_actors` para guardar autoria de novas transições operacionais. A tabela tem RLS ativa, sem leitura/escrita direta para clientes, e FK de ator com `ON DELETE RESTRICT`. Triggers adicionais registram usuário/nome no servidor; não fazem backfill, atualização em massa ou mudança de estado. A FK pode impedir excluir contas que tenham novos eventos: preservar/desativar o acesso conforme procedimento administrativo aprovado.

A consulta `portaria_timeline_sources` exige perfil ativo e retorna campos operacionais selecionados. Não retorna contas Auth, assinaturas, CNH, caminhos de documentos ou URLs de fotos. Os detalhes desses documentos continuam nos módulos existentes, sob os controles privados já preparados. Novas RPCs e funções auxiliares têm permissões explícitas; nenhuma chave privilegiada vai para o frontend.

O contrato final passa a **4**, com **seis** templates obrigatórios. O cliente recusa o contrato anterior e pacotes incompletos. Hashes dos templates atuais foram recalculados em `.cache/original-review/candidate-hashes.json`. Isso não é aprovação nem hash do SQL final renderizado com destino/baseline/backup. A preparação futura e a aprovação dos arquivos finais precisam usar os seis candidatos. Recibos/pacotes anteriores não liberam esse frontend.

As pré-condições conferem marcador, backup e objetos anteriores esperados. A reaplicação de 006 foi testada no PostgreSQL em memória. Não reaplicar 001–005 por cima do contrato 4. Se alguma versão tiver sido aplicada por outro procedimento, inventariar antes de decidir a atualização. O pacote DEV e o histórico de migrations nunca devem ser executados no original.

Novo postflight somente leitura: `supabase/original/06_refinements_postflight_readonly.sql`. O postflight 05 pertence ao estágio anterior: a verificação antiga que proibia desconhecido/OK não se aplica à nova regra física. Após 006, usar 06 e a comparação de preservação 04, além das verificações de Storage/autorizações relevantes de 02. Em 06, marcador 4 deve ser 1; inconsistências devem ser 0; a distribuição por `meaning` é informativa e pode conter registros antigos e novos.

## Arquivos principais

- `src/App.tsx`, `src/components/ManagementView.tsx`: Gestão, navegação e compatibilidade de links.
- `src/components/UnifiedPortaria.tsx`, `DailyYard.tsx`, `YardRow.tsx`, `PatioVehicles.tsx`, `ResponsiveTable.tsx`: conferência, encaminhamento seguro e lista responsiva.
- `src/components/ParcelsView.tsx`, `ParcelTable.tsx`: lista e retirada compacta.
- `src/components/TimelineView.tsx`, `OperationalView.tsx`, `src/services/timelineService.ts`: Timeline única, inclusive na navegação administrativa anterior.
- `src/domain/yard.ts`, `logisticsStore.ts`, `vehicleOperations.ts`, `timeline.ts`, `reconciliation.ts`, `reporting.ts`: regras, histórico, pareamento e indicadores.
- `src/domain/demoStore.ts`, `src/demo/DemoProvider.tsx`: autoria fictícia das operações simuladas.
- `src/config/originalRelease.ts`, `src/types/database.ts`, scripts de hashes e testes de contrato: pacote seis/contrato 4.
- Nova 006, postflight 06, testes unitários/SQL e `tests/browser/refinements.spec.ts`, além dos testes existentes atualizados.

## Validação e próximas ações manuais

Testes locais cobrem as quatro combinações físicas, desconhecidos, imutabilidade, diferenças de critério, encaminhamento operacional/legado após filtros/datas, listas desktop/celular, todos os onze tipos da Timeline, autoria distinta nas transições, pareamento conservador e preservação das funções de Gestão. Os testes SQL usam dados fictícios e contrato de colunas derivado dos metadados locais, não registros do original.

| Verificação executada | Resultado |
|---|---|
| `npm run check` | Lint sem avisos, TypeScript, **131 testes aprovados** e build aprovados |
| `npm run build:demo` | Build demonstrativo aprovado |
| Navegador desktop/celular | **48 cenários validados**: 46 aprovados na suíte completa e os dois cenários da Timeline aprovados na reexecução após corrigir a sequência dos modais, o nome acessível do filtro e o prazo da jornada completa |
| Regressão visual | **16 comparações de imagem** aprovadas sem atualizar referências na validação final dos cenários. Referências novas foram geradas na primeira passagem e inspecionadas localmente |
| Prévia 5173 | HTTP 200, modo demo, quatro menus, zero requisições externas; continua disponível |
| Diff | Verificação aprovada respeitando CRLF do Windows, sem normalizar arquivos ou alterar configuração Git |
| SQL/hashes | 001–006 e postflights exercitados em PostgreSQL WASM; seis hashes de templates recalculados. Nenhuma execução remota |

A jornada integrada da Timeline tem prazo de 60 segundos por cobrir inspeção, acesso de pessoa, encomenda, conferência e onze filtros no mesmo cenário. A reexecução final levou aproximadamente 19 segundos no desktop e 6 no celular. Navegadores/câmera são locais e usam mídia fictícia; não comprovam o dispositivo físico nem os serviços gerenciados.

1. Revisar a prévia fictícia: quatro cenários físicos, alertas e mensagens; entrada pela conferência, cancelando antes de confirmar; filtros/listas; retirada de encomenda; Timeline e Gestão. Testar câmera e toque em aparelho físico quando houver prévia HTTPS acessível autorizada. `127.0.0.1` em outro aparelho aponta para o próprio aparelho.
2. Antes de qualquer operação remota, seguir `ORIGINAL_BACKUP_RUNBOOK.md`: backup consistente do banco e bytes do Storage fora do repositório/pastas sincronizadas, manifestos/checksums e ensaio de restauração isolado aprovado. Incluir todas as tabelas `portaria`, eventos novos, Auth e arquivos. Checksum sozinho não comprova restauração.
3. Revalidar estrutura, policies efetivas, buckets, contagens e hashes antes da janela; conferir documentação das 65 URLs e os 17 estados sem correções automáticas. Aprovar os seis SQLs finais e, separadamente, configurações de Storage/Auth/perfis e publicação. Não há novo bucket exigido por 006; permanecem os pré-requisitos privados de 003–005.
4. Aplicar somente em janela aprovada, com aplicação antiga parada, executar postflights na ordem correta e comparar preservação 04 ao baseline sem escritas concorrentes. Ensaiar Auth/Storage/PostgREST e concorrência com perfis reais em destino aprovado antes da liberação do original.
5. Se falhar antes do commit SQL, parar e confirmar rollback. Após commit, bloquear operações e preservar novas conferências/encomendas/eventos: não apagar tabelas, voltar o significado dos resultados ou restaurar sobre novas escritas sem reconciliação. Frontend anterior de contrato 3 não é rollback compatível com o contrato 4; manter indisponibilidade ou preparar correção compatível. Compensação/restauração exige plano e aprovação específicos.

Permanecem pendentes os ensaios gerenciados, concorrência entre conexões reais, desempenho com volume real, câmera física e aprovação de implantação. Os resultados finais dos comandos locais estão na entrega; não substituem essas verificações.
