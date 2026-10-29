# Verificação de óleo — proposta técnica, sem implementação

**Atualização da execução final:** o controle foi implementado localmente em frontend/demo/backend, com migration 007 e testes. Consultar [FINAL_INSTALL.md](FINAL_INSTALL.md) para o estado vigente. O texto abaixo preserva o planejamento anterior; não significa ausência da implementação atual nem autoriza instalação.

Estado de 28/10/2026: análise solicitada, **sem alteração de design, frontend, banco ou migrations**. A aprovação de 001–006 permanece separada e bloqueada pelos pontos do [relatório de compatibilidade](ORIGINAL_COMPATIBILITY_FINAL_REVIEW.md). Não há dependência externa nova nem necessidade de bucket para esta funcionalidade textual.

**Decisões confirmadas pelo usuário nesta revisão:** óleo exige identificação válida do veículo; tentativa “Não foi possível verificar” gera histórico, sem reiniciar dias desde a última medição efetiva; a interface distingue última tentativa de última medição válida. Apenas o plano foi atualizado; não existe migration 007.

## Comportamento proposto

Na própria linha da conferência diária, o toque em **OK — veículo encontrado** abre campos inline, usando cards, cores, tipografia e componentes já aprovados. Antes da confirmação definitiva, mostrar a última verificação identificada com segurança, seu nível, data e dias decorridos; disponibilizar Normal, Baixo, Crítico ou Não foi possível verificar, sem seleção prévia de Normal, e observações livres opcionais.

Proposta: seleção obrigatória para novo OK; confirmar junto com o resultado físico. NOK continua sem exigir óleo e sem criar registro fictício de óleo. O histórico já salvo permanece consultável e não recebe preenchimento retroativo. Sem evento anterior, mostrar “Sem histórico”, sem usar criação do veículo ou conferência antiga como data de óleo.

O componente atual `YardRow` chama `onCheck` imediatamente; `DailyYard`/`logisticsService.check` persistem a conferência, que fica imutável. Portanto, acrescentar um formulário depois de salvar OK criaria confirmação incompleta. A alteração futura deverá recolher e validar os campos **antes de persistir**, com confirmação atômica de conferência + óleo.

## Migration 007 independente

É adequada uma migration incremental **aditiva e dependente de 006/contrato 4**. Não modificar 001–006 para inserir essa funcionalidade nem executar a proposta agora. Uma futura release com 007 deve ter contrato e manifesto novos (proposta: contrato 5), hashes/aprovação específicos e frontend compatível. O mecanismo atual enumera exatamente seis migrations e contrato 4; incluí-la exige atualizar também validação/liberação e evidência de recuperação/dispensa, sem reaproveitar uma aprovação antiga.

Proposta de tabela privada `portaria.oil_checks`:

| Campo/vínculo | Finalidade |
|---|---|
| UUID do evento/tentativa | Identificação imutável e repetição segura |
| `yard_check_request_id` único | FK para **`portaria.yard_checks(request_id)`**, que é a PK existente; não existe `yard_checks.id` |
| Item de conferência | Vincular sessão e referência congeladas |
| `vehicle_id` | Obrigatório; FK RESTRICT para veículo cadastrado e corretamente identificado, coerente com o item de conferência |
| Nível com CHECK | Quatro códigos normalizados com rótulos em português na interface |
| Observações limitadas | Texto opcional, por exemplo até 2.000 caracteres |
| Data/hora do registro | Gerada pelo servidor em UTC; exibição em America/Sao_Paulo |
| Responsável e nome no momento | `auth.uid()` e perfil ativo obtidos no servidor; nunca confiar no nome enviado pelo navegador |

Índice por veículo/data/hora/ID para obter o último evento de forma determinística; unicidade por conferência para impedir duplicidade. Preservar eventos, IDs, timestamps e responsáveis. Caso correção de óleo seja necessária, preferir evento de retificação com vínculo ao anterior, aprovado como regra própria; não sobrescrever histórico.

## API, integridade e segurança

- RPC autenticada valida perfil ativo, identificação válida do veículo, vínculo item/sessão/veículo, conferência pendente, resultado físico e nível permitido. Nenhum evento de óleo pode ser salvo com `vehicle_id` ausente, inexistente ou incompatível. Salvar conferência e óleo na mesma transação; falha em qualquer parte desfaz ambas.
- Manter UUID estável por tentativa inclusive após timeout. Mesma tentativa com os mesmos dados deve retornar o resultado existente; dados diferentes com o mesmo UUID devem falhar. O serviço atual cria UUID novo em cada chamada e precisa ser adaptado.
- Com concorrência, uma confirmação vence; nenhuma retirada/entrada de veículo é inferida ou registrada pelo check de óleo. Reaproveitar os locks existentes sem alterar o estado operacional do veículo.
- RLS habilitada, sem CRUD direto ou EXECUTE anônimo. Escrita por RPC SECURITY DEFINER com search_path fixado e validação de autoria/perfil; leitura restrita aos perfis autorizados.
- Não deixar a RPC antiga de confirmação acessível como bypass do óleo obrigatório. Uma alternativa é criar wrapper na 007 e revogar a execução direta antiga para os papéis do app, mantendo a chamada interna revisada; isso exige coordenação com contrato novo. Revisar também os caminhos `portaria_found_yard_vehicle` e a conferência legada `portaria_register_conference`, preservando consulta do histórico útil.
- Retornar último nível/data e dias em uma consulta agregada, evitando uma requisição por linha. Histórico deve ser paginado quando crescer. Não incluir documentos, assinaturas ou credenciais nas respostas/logs.

## Semântica temporal e decisões confirmadas

**Última tentativa e última medição válida:** “Não foi possível verificar” gera evento no histórico, mas não é medição efetiva e não reinicia o contador. Normal/Baixo/Crítico são medições efetivas. Consultar separadamente a última tentativa (qualquer uma das quatro opções) e a última medição válida; quando diferirem, apresentar ambas com data e resultado. Rotular o contador “Dias desde a última medição válida”. Se nunca houve medição efetiva, mostrar “Sem medição válida registrada”, mesmo que existam tentativas frustradas; não calcular dias desde a criação do veículo.

**Dias decorridos:** contar dias de calendário em America/Sao_Paulo usando horário confiável do servidor. O evento físico ocorre no instante do registro; selecionar uma sessão antiga não deve retroagir a medição de óleo. Para detalhes históricos, mostrar o último evento anterior ao instante da conferência ou guardar vínculo explícito com ele; novos checks não podem mudar retroativamente a informação apresentada como contexto histórico.

**Veículo encontrado sem cadastro:** o fluxo atual permite item com `vehicle_id=NULL`, mas a decisão aprovada exige identificação válida para óleo. Não criar evento provisório de óleo nem juntar históricos por placa. A futura interface deve oferecer identificação explícita de veículo cadastrado antes da confirmação que inclua óleo; enquanto não houver vínculo válido, indicar pendência de identificação. O vínculo deve ser validado no servidor e auditado, sem sobrescrever conferências já concluídas. Não criar cadastro automaticamente nem emprestar o histórico de outro veículo por coincidência textual.

**Crítico:** a solicitação não autoriza bloquear saída, criar manutenção ou alterar situação do veículo automaticamente. Essa automação fica fora do escopo. Observações são opcionais; exigir motivo adicional em “Não foi possível verificar” seria outra decisão, não requisito já autorizado.

## Arquivos e testes futuros

Arquivos candidatos: `src/components/YardRow.tsx`, `src/components/DailyYard.tsx`, `src/domain/yard.ts`, `src/services/logisticsService.ts`, store/demo com dados fictícios, tipos de RPC e contratos/manifestos de release. Acrescentar migration 007 e postflight próprios somente após aprovação do desenho. Nenhum desses arquivos foi alterado por esta análise.

Testes necessários antes de futura aprovação:

1. OK com cada um dos quatro níveis; OK sem nível/nível inválido rejeitado; NOK sem óleo aceito; notas opcionais e limites. Tentativa frustrada cria histórico sem reiniciar o contador e mantém a última medição válida visível.
2. Autoria falsa, usuário anônimo/inativo, veículo/item/sessão incompatíveis e RPC antiga sem autorização rejeitados.
3. Atomicidade em falha, duas confirmações concorrentes, repetição após timeout e conflito de UUID.
4. Histórico imutável, consulta temporal, ausência de medição válida, virada de dia/fuso e rejeição de registro de óleo sem identificação válida ou com veículo incompatível.
5. Integração com “encontrado não esperado”, preservação do significado físico de OK/NOK, contadores e divergências.
6. Regressão de navegação/desktop/celular e estilo aprovado; texto livre escapado na interface e exportações seguras.

Os testes acima são planejamento, **não resultados executados**. A 007 não existe e não foi aplicada nem autorizada.
