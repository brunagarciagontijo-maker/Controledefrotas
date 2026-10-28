# Validação final somente leitura — Supabase original

**Atualização de 28/10/2026 após recebimento do JSON e autorização de correções locais:** a 002 e o comparador foram corrigidos/testados no computador. A comparação agora retorna `catalog_and_aggregates_match_manual_review_required`, com seis campos EXECUTE reconciliados pelo 00b anterior. Consulte o [relatório consolidado vigente](ORIGINAL_COMPATIBILITY_FINAL_REVIEW.md), incluindo hashes novos. A implantação permanece bloqueada por evidências e autorizações pendentes; nenhuma migration remota foi executada. As instruções abaixo registram a preparação anterior, não uma nova solicitação de execução remota.

**Revisão SQL 2:** [requisitos, guardas RLS e 20 verificações locais](ORIGINAL_PREFLIGHT_SQL_REVIEW.md). Usar o arquivo 07 revisado e o hash atualizado. Ele acrescenta duas guardas antes da coleta, `row_security=off` como erro de proteção e chamadas nativas qualificadas. O gerador anterior foi preservado pelo escopo desta revisão: **não reexecutar `original:preflight-prepare`, pois sobrescreveria o SQL revisado**. Não houve acesso remoto ou alteração dos JSONs existentes.

Estado de 28/10/2026, branch `desenvolvimento`: **validação remota atual ainda pendente**. O perfil configurado continua `original` / `metadata-only`, sem release. O SDK recusou criar cliente antes de qualquer chamada de rede. Foram feitas **zero consultas remotas**, sem cliente alternativo, uso de chave administrativa, acesso direto à API, login ou alteração de perfil.

A autorização atual permite a auditoria de leitura; como o perfil bloqueia o acesso programático, foi usada a alternativa solicitada pelo usuário: preparar SQL somente leitura para execução manual no SQL Editor. Não é necessário instalar ferramenta, liberar escrita ou executar `original:authorize-write`, `dev:original` ou `build:original`.

## Pacote manual preparado

Abrir [07_final_preflight_readonly.sql](.cache/original-review/final-preflight/07_final_preflight_readonly.sql). O [manifesto local](.cache/original-review/final-preflight/manifest.json) registra SHA-256 do arquivo e dos cinco SQLs de origem. O [estado da comparação](.cache/original-review/final-preflight/comparison.json) está como `pending_manual_readonly_snapshot`; isso é pendência de entrada, não resultado de uma consulta remota.

O arquivo une os SQLs 00, 00b, 01, 03 e 04 já revisados, em **uma única transação `REPEATABLE READ READ ONLY`**, com timeout de 60 segundos, lock timeout de cinco segundos, UTC e `ROLLBACK` final. Na revisão 2, duas guardas auxiliares devem retornar 1; o resultado principal final é a coluna JSON `preflight`. Executar o arquivo inteiro, sem selecionar apenas o último SELECT.

Inclui:

- Tabelas, colunas/defaults, constraints, índices, funções, triggers, RLS, policies e grants nos escopos dos inventários anteriores.
- Versões do histórico de migrations e presença de schema/marcador `portaria`; ledger ausente é tratado sem criar tabela nem consultar estaticamente uma relação inexistente.
- Colunas gerenciadas de Auth/Storage e EXECUTE; nenhum registro de usuário Auth é exportado.
- Os 14 checks agregados de integridade, cruzamento operacional e totais históricos.
- Diagnóstico dos 17 casos de revisão, referências documentais/65 URLs e contagens/tamanhos informados dos quatro buckets, sem retornar paths, URLs, IDs pessoais ou objetos individuais.
- Contagens e SHA-256 agregados dos campos originais das dez tabelas. Dados são processados internamente para agregação; nenhum registro individual é retornado.
- Cobertura de leitura das dez tabelas e das duas relações Storage: SELECT disponível e ausência de filtragem RLS precisam ser verificáveis. Zero linhas com cobertura insuficiente não é aceito como preservação.

Definições/defaults/expressões das policies são representados por hashes; não são exportados em texto. Nenhum arquivo Storage, URL documental ou fotografia é aberto/baixado. Os metadados não comprovam recuperação/integridade dos bytes dos arquivos. O rótulo de projeto é um hash inserido localmente: **não é prova fornecida pelo servidor de que foi executado no projeto certo**. A confirmação do projeto no painel continua indispensável.

## Próximo passo manual — já no escopo de leitura autorizado

1. No painel, conferir o **mesmo projeto original** identificado na configuração local. Não copiar chaves, senhas, URL privada ou connection string para o chat.
2. Abrir o SQL Editor e executar **somente o arquivo 07 acima**, após conferência de seu conteúdo. Não executar os candidatos 001–006 ou pacotes de banco vazio. Se o projeto estiver pausado, faltar permissão ou houver erro de contrato, parar; não reativar projeto, alterar permissões ou adaptar o banco para fazer a consulta passar.
3. Salvar o JSON completo da coluna `preflight` em **`.secrets/original-final-preflight.json`**. JSON direto ou exportação de uma linha com a coluna `preflight` são aceitos. Não salvar CSV, resultados parciais ou inventário antigo com nome novo. **Preservar os quatro inventários antigos.** Não enviar o conteúdo ao chat.
4. Avisar que o arquivo foi salvo. A comparação local pode então ser executada com:

```powershell
npm run original:preflight-compare
```

Esse comando somente lê arquivos locais e grava relatório agregado em `.cache/original-review/final-preflight/comparison.json`. Não cria conexão, executa SQL, altera perfil ou concede aprovação de migration. Na ausência do snapshot, informa pendência e sai sem tentar a rede. O npm pode retornar código não zero nessa pendência; consultar o status JSON, não interpretar como erro do banco remoto.

O gerador `original:preflight-prepare` ainda corresponde à revisão anterior e **não deve ser usado para regenerar este arquivo** até sua sincronização futura. Nesta etapa, usar o SQL revisado diretamente e o manifesto de hash vigente.

## Comparações e critérios de interrupção

O comparador exige PostgreSQL 17, transação somente leitura/repeatable read, fontes de consulta atuais, rótulo compatível com a configuração local e cobertura de leitura. Compara as dez coleções do catálogo, publicações, presença de tabelas Auth/histórico, contrato gerenciado, checks e metadados documentais. Verifica também o fingerprint exato exigido por 001 e a integridade dos seis candidatos renderizados/templates atuais. Campos informativos como horário de coleta e texto explicativo não são interpretados como mudança do banco.

**Interromper antes de migration** se houver schema/marcador `portaria` já existente, fingerprint diferente, migrations adicionais/ausentes, mudança de constraints/functions/triggers/policies/grants, alteração inesperada de buckets, cobertura incompleta, snapshot inválido, falha nos hashes dos candidatos ou divergência de contagens/digests. Uma mudança pode ser legítima, mas exige análise e decisão; não implica correção automática.

A consulta é uma fotografia: não bloqueia escritas concorrentes de outras sessões e não garante que o estado permanecerá igual até a implantação. Comparar o baseline da janela antes de qualquer alteração futura; manter verificações de fingerprint/estágio dos candidatos. Não é necessário dispensar essas proteções para seguir a estratégia sem backup.

## Confirmado pelas auditorias anteriores, ainda não reconfirmado remotamente

| Referência recebida | Resultado conhecido |
|---|---|
| Estrutura | PostgreSQL 17; dez tabelas públicas, 146 colunas, 21 migrations |
| Diferenças do modelo preparado | Seis campos de autoria ausentes; 39 diferenças de obrigatoriedade; nenhuma diferença de tipo; oito diferenças de default |
| Segurança | RLS habilitada no escopo público recebido; 41 policies amplas e dois buckets públicos auditados |
| Integridade operacional | Duplicidades/conflitos/órfãos/placas = 0 nos checks recebidos |
| Casos de revisão preservados | 17 veículos fora sem saída aberta; não reconciliar flags automaticamente |
| Documentos | 65 URLs HTTP(S) persistidas; correspondência de metadados não prova publicidade nem validade da URL |
| Histórico | 185 registros legados, 144 movimentos e 90 acessos |
| Storage | Quatro buckets, 236 objetos e 377.593.104 bytes informados; nenhum byte de documento baixado nesta etapa |

**Não foi encontrado baseline anterior de `04_preservation_readonly.sql`.** Os inventários antigos e 14 checks permitem comparar estrutura e agregados, mas não provar igualdade de IDs, vínculos e conteúdo antigo apenas porque as contagens coincidirem. A nova coleta criará o primeiro baseline de digests disponível desta janela; não pode comprovar retroativamente ausência de alteração desde auditorias passadas. Se existir baseline anterior guardado em outro local, informar somente sua localização local aprovada, sem publicar conteúdo pessoal.

Configurações externas de Auth/providers/SMTP/hooks, propriedade/privilégios não exportados pelos inventários anteriores, permissões efetivas por JWT e entrega real de Storage/Realtime continuam fora da comprovação deste pacote. Hash de definição não é revisão semântica do corpo; eventuais diferenças precisam de inspeção privada. Não coletar usuários ou documentos para suprir essas limitações.

## Compatibilidade e autorizações seguintes

**Não é possível afirmar compatibilidade com o estado remoto atual ainda.** Os seis candidatos permanecem coerentes com o inventário local conhecido e seus hashes estão íntegros; nenhuma aprovação de aplicação é emitida pelo comparador. Mesmo um resultado de catálogo/agregados iguais exige revisão humana das ressalvas e confirmação da janela/projeto.

Após receber e analisar o snapshot, serão necessárias autorizações específicas para:

1. SQLs executáveis finais 001–006/hashes, janela e registro local da dispensa de backup já expressa pelo usuário. Aceitação de perda não autoriza reset/exclusão de dados pessoais.
2. Privacidade/criação dos buckets e atribuição de perfis/contas aprovadas. Essas operações não estão incluídas na autorização de leitura atual.
3. Operações reais de Auth/frontend, inclusive `original:authorize-write` e uso operacional de `dev:original`, somente após migrations/postflight validados.
4. Publicação, domínio HTTPS e revisão de GitHub/Netlify em etapa própria. Nenhum commit/push/merge/deploy é autorizado agora.

Não será exigido retomar instalação de Docker/WSL/clientes de backup ou laboratório. Sem backup, dados/arquivos perdidos após COMMIT podem não ser recuperáveis; esse risco continua registrado, sem reduzir a proteção de dados existentes.

## Checklist

- [x] Perfil original metadata-only e bloqueio SDK confirmados, sem contornar a proteção.
- [x] Pacote manual de leitura única preparado e hash conferido.
- [x] Comparador local preparado, sem aprovação automática de escrita e sem sobrescrever auditorias antigas.
- [x] Identificada a ausência de baseline histórico de digests; limites de comprovação registrados.
- [ ] Usuário executar leitura manual e salvar o JSON atual.
- [ ] Comparar efetivamente estado atual e auditar divergências com os inventários recebidos.
- [ ] Emitir diagnóstico de compatibilidade atual e solicitar aprovação das operações de alteração específicas, se adequadas.

Validação da geração anterior: dez testes de comparação, lint/TypeScript e análise de sintaxe com banco vazio. **A revisão SQL 2 acrescentou 20 verificações de execução integral com fixtures fictícias em PostgreSQL 18 em memória**, incluindo RLS e permissões negativas; detalhes e limitação em relação ao runtime original 17 estão no [relatório da revisão](ORIGINAL_PREFLIGHT_SQL_REVIEW.md). Nenhum candidato de migration foi executado, nenhum serviço remoto foi acessado e os seis templates permanecem inalterados. Os testes locais não substituem execução no schema original nem comprovam restauração.
