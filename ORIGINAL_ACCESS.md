# Supabase original — acesso e inventário

A estratégia atual usa o projeto original. **Não execute `supabase/dev`, `supabase/database.sql` ou as 21 migrations históricas nele.** Esses arquivos não são uma atualização incremental do banco existente.

## Inventário inicial — recebido e comparado localmente

O arquivo local foi recebido e comparado, sem conexão remota por este computador. O diagnóstico está em [ORIGINAL_IMPLEMENTATION.md](ORIGINAL_IMPLEMENTATION.md). Para atualizar o inventário futuramente:

1. No SQL Editor do projeto original autorizado, abra `supabase/original/00_inventory_readonly.sql` deste repositório.
2. Confira o projeto no painel e execute somente esse arquivo. Ele abre transação READ ONLY, consulta metadados e termina com ROLLBACK. Não exporta registros operacionais, emails, UUIDs de usuários, nomes de arquivos ou objetos do Storage.
3. Copie o objeto JSON da coluna `inventory` para `.secrets/original-inventory.json`, no computador. A pasta é ignorada pelo Git. Não copie a lista de usuários nem senhas/chaves. Se o painel exportar CSV, copie apenas o JSON da célula.
4. Avise quando o arquivo estiver salvo. Não é necessário enviar credenciais ao chat ou habilitar conexão direta com o banco.

O inventário inclui nomes de objetos e hashes das definições. Textos de policies, corpos de funções e defaults são completamente omitidos, evitando depender de expressões regulares para ocultar literais. Caso um identificador do schema contenha informação pessoal, remova esse identificador antes de compartilhar qualquer saída. O arquivo permanece local e não deve ser versionado.

## Complementos recebidos e analisados

Os arquivos `.secrets/original-managed-inventory.json` e `.secrets/original-integrity.json` foram recebidos e analisados. As instruções abaixo ficam como referência para atualização. A [revisão consolidada atual](ORIGINAL_PREDEPLOY_REVIEW.md) registra os totais 185/144/90, os 17 casos de pátio e as 65 URLs, sem exportar registros pessoais.

1. Execute manualmente somente `supabase/original/00b_managed_contract_readonly.sql` no SQL Editor do projeto conferido. Salve o JSON da coluna `managed_inventory` em `.secrets/original-managed-inventory.json`. Ele retorna apenas tipos de colunas gerenciadas e permissões EXECUTE efetivas, sem consultar registros de usuários ou arquivos.
2. Depois de conferir os nomes e colunas, execute somente `supabase/original/01_integrity_readonly.sql`. Salve a tabela de contagens em `.secrets/original-integrity.json` ou outro arquivo privado ignorado. Não substitua o inventário inicial por esse resultado e não exporte linhas operacionais.
3. Confirme os dois arquivos disponíveis localmente. Não envie credenciais, documentos, usuários nem registros ao chat. As contagens não autorizam correção automática de inconsistências.

Os dois complementos usam transação READ ONLY, limite de tempo e ROLLBACK. Nenhuma dessas consultas foi executada remotamente por esta entrega. Não execute `02_postflight_readonly.sql` antes das migrations aprovadas, pois depende dos objetos novos.

## Próximo diagnóstico manual, sem alteração

Execute somente `supabase/original/03_documents_patio_readonly.sql` no projeto conferido e salve o JSON da coluna `review` em `.secrets/original-documents-patio.json`. Ele retorna contagens por status e referências documentais com caminho ausente, objeto ausente/único/ambíguo, além de totais de metadados dos quatro buckets. Não acessa URLs nem retorna documentos, pessoas, caminhos ou tokens. Sintaxe e categorias foram testadas em PostgreSQL local com dados fictícios; os resultados reais ainda não foram recebidos.

`04_preservation_readonly.sql` está preparado para comparar contagens e hashes dos campos originais das dez tabelas antes/depois da janela, sem retornar registros. Execute-o no baseline final e no postflight, sem operações concorrentes, conforme [ORIGINAL_BACKUP_RUNBOOK.md](ORIGINAL_BACKUP_RUNBOOK.md). Não é comprovante de backup.

O acesso ao painel não configura automaticamente uma conexão deste computador. Este fluxo não exige senha no chat, service_role, conexão direta nem login da aplicação no original.
