# Auditoria visual e funcional — Sistema Portaria

**Refinamento vigente autorizado:** [REFINEMENTS_STATUS.md](REFINEMENTS_STATUS.md): quatro menus com Gestão unificando Banco/Relatórios; tabelas/listas responsivas; conferência física OK/NOK independente; Timeline completa. Essas alterações intencionais substituem os formatos anteriores, mantendo identidade e funções úteis.

**Atualização funcional posterior autorizada:** [Pátio unificado, Encomendas e conferência diária](PATIO_LOGISTICS_IMPLEMENTATION.md). Registro deixou de ser menu independente (cinco entradas restantes); checkbox adicional Cobli e leitura QR da busca foram removidos por solicitação. Essas mudanças substituem as referências anteriores a seis menus e conferência por modal, preservando a identidade visual restaurada.

Revisão de 27/10/2026 na branch `desenvolvimento`, comparada com `HEAD` original `98e8df0` e o histórico disponível. Não houve checkout, troca de branch, reset, commit, push, merge, instalação ou deploy. Nenhuma conexão/operação no Supabase original foi executada.

## Diagnóstico confirmado

A simplificação não veio da remoção do arquivo de estilos: `src/index.css` conservava a identidade original. A regressão principal estava em `App.tsx` e no primeiro `UnifiedPortaria`: fundo opaco cobrindo a composição, elementos decorativos não renderizados, cabeçalho reduzido, seis entradas de menu substituídas por quatro, Banco e Registro sem acesso direto e recursos operacionais escondidos em uma área administrativa. Cards novos também omitiam informações presentes nos componentes anteriores.

Havia ainda uma limitação funcional da demonstração: relatórios vazios, cadastros sem simulação de edição, filtros ignorados e inspeções ocultas. Alguns desses botões tentavam usar o SDK bloqueado. Isso dava a impressão de recursos removidos mesmo quando o componente original continuava disponível.

## Comparação e resultado por área

| Área original | Regressão / diferença encontrada | Correção ou integração |
|---|---|---|
| Identidade | Fundo sólido, cabeçalho menor e cards genéricos | Restaurados logo, dimensões, tipografia do sistema, fundo mesh, esferas/acentos, glass, sombras, gradientes vermelhos, espaçamentos e ícones Lucide. Mantidas preferências de movimento reduzido |
| Navegação | Registro e Banco deixaram de ser entradas principais | Restauradas seis entradas: Registro, Banco, Relatórios, Pátio, Veículos e Sair. Estado ativo azul e estrutura original; botões adaptados ao celular |
| Registro | Formulário antigo deixou de estar na navegação; fluxo novo sem assinatura | Menu Registro abre o mesmo formulário seguro usado pelo Pátio. Assinatura obrigatória também nas novas saídas, conforme decisão explícita do usuário; não há segundo atalho de INSERT legado |
| Informações da saída | Data/hora, observações e campos complementares simplificados | Restaurados data, hora, observações, motivo da utilização e autorização informada; últimos dois como informações complementares, sem conceder permissão. Veículo exibe código, responsável, uso e condutor fixo |
| Pátio | Cards mínimos e ausência da visão geral | Restaurados indicadores de abertos/no pátio/em obra/motoristas ativos, cards completos, busca por código/placa/nome/responsável, leitor QR e mensagens de disponibilidade |
| Devolução operacional | Modal reduzido a odômetro, combustível e marcações | Restaurados data/hora, observações gerais e por item, motorista de entrada e fotos opcionais. O motorista de entrada é registrado nas observações; não substitui a identidade do motorista da saída |
| Funcionários/pessoas | Cadastro escondido dentro de área genérica | Cadastro original reutilizado em aba própria para admin, com criação/edição, busca, filtros, status e dados pessoais fictícios no demo. Porteiro mantém o acesso de pessoas permitido |
| Motoristas | Gestão e estatísticas difíceis de encontrar | Tela original reutilizada diretamente, preservando cadastro, edição, inativação/reativação, busca, ordenação e estatísticas disponíveis no componente |
| Timeline | Acesso escondido atrás de área administrativa | Aba própria disponível para operação, reutilizando a timeline original, eventos de saída/entrada e visualização privada de fotos |
| Banco | Histórico legado aninhado no fluxo novo | Entrada direta com busca, status, datas, estatísticas, detalhes, assinaturas, edição/devolução legada, CSV, Excel de utilização diária, impressão e veículos por data. Histórico novo em aba própria, sem duplicar dados no banco |
| Histórico novo | Lista resumida sem filtros ou detalhes | Componente compartilhado `MovementHistory`: código/placa/motorista, status, tipo de operação, período, limpeza de filtros, CSV/impressão, detalhes de saída/retorno, confirmação Cobli, assinatura e fotos |
| Relatórios | Dashboard mostrava somente registros anteriores | Mantido Dashboard original com períodos, rankings e indicadores; adicionada origem Todos/Anteriores/Portaria. Projeção somente em memória, sem converter registros históricos no banco |
| Frota/pessoais | Componentes existentes, mas ações de demo incompletas | Preservados cadastro/edição, status, condutor fixo, filtros, veículos pessoais e seus responsáveis, QR/PNG/impressão e solicitações de inspeção; simulação ampliada sem SDK remoto |
| Inspeções | Sininho escondido no demo; serviço sem simulação | Restaurados notificação, solicitação e conclusão com checklist. Eventos locais atualizam o demo; integração Realtime real continua separada e pendente |
| Links/QR anteriores | Alguns aliases de parâmetros deixaram de ser lidos | Recuperados `code`, `personal_vehicle` e aliases de telas, preservando a validação de origem. QR de outro ambiente continua recusado |
| Modais | Portal original preservado, mas teclado/rótulos incompletos | Mantido portal para fora dos ancestrais com blur; acrescentados rótulos, foco, contenção de Tab, Escape, retorno do foco e restauração de scroll. Corrigidos nomes acessíveis do sino e dos botões de detalhes |
| Sair | Confirmação original havia desaparecido | Restaurada confirmação de saída; cancelamento mantém a sessão atual |

O menu Registro e o Pátio usam `UnifiedPortaria`/`CompanyDepartureForm`; funcionários, motoristas e timeline reutilizam `OperationalView` em modo incorporado. Não foram criados cadastros ou fluxos de saída paralelos.

## Melhorias e proteções preservadas

- Confirmação manual Cobli vinculada a motorista/veículo; associado dispensa fotos de checklist; não associado exige motivo e as seis fotos.
- Visitante exige captura documental pela câmera; funcionário continua sem Motivo da visita; terceiro preserva anexos compatíveis.
- Conferência física registra divergência sem reconciliar automaticamente os 17 estados de pátio.
- Auth real, perfil ativo no servidor, pinagem de projeto/chave/origem, bloqueio do original antes de liberação e ausência de fallback inseguro.
- Storage privado, URLs temporárias, proteção do histórico, saneamento de assinaturas/HTML/CSV, preservação dos arquivos anteriores e idempotência das saídas.
- As 21 migrations históricas e o procedimento de backup/restauração continuam preservados.

Não foram restaurados login por credenciais fixas, confiança em flags do localStorage, links públicos documentais, atalhos que ignoram Cobli/RLS, exclusão de histórico ou service worker no desenvolvimento. O botão de exclusão do histórico permanece indisponível onde a política de preservação o proíbe; cadastro relacionado deve ser desativado. A instalação PWA/cache permanece fora desta revisão local.

## Assinatura e candidato SQL local

A decisão do usuário foi **exigir assinatura também nas novas saídas**. O canvas original foi reutilizado; novos registros usam PNG, imagens externas/SVG são recusadas e tela vazia não é aceita. Trocar motorista/veículo limpa a assinatura para impedir reaproveitamento acidental. Assinaturas antigas JPEG/PNG continuam visualizáveis.

O candidato `supabase/original/incremental/003_operations.sql` foi ajustado localmente: valida assinatura de novas saídas e a mantém no snapshot JSON protegido, junto dos campos complementares. O retorno não pode reescrever esses valores. Não houve coluna nova, preenchimento de assinaturas antigas ou migração de dados nesta revisão. Validação de formato não comprova identidade biométrica ou consentimento jurídico.

**O candidato não foi aplicado.** O hash do lote mudou e qualquer pacote SQL renderizado/aprovado anteriormente precisa ser revisado novamente. A interface original segue bloqueada; a demonstração grava somente em memória.

## Testes e evidências

Resultados confirmados: `npm run check` passou com lint, TypeScript, 93 testes de negócio/segurança/PostgreSQL em memória e build. A rodada completa de Playwright passou com 30 testes em Desktop Chrome e Pixel 7 emulado; os seis cenários afetados pelos últimos ajustes de campos/filtros foram repetidos e passaram, incluindo comparação visual sem atualização de referências. O navegador bloqueia requisições externas e verifica ausência de erros de página.

Cobertura de navegador inclui os cinco destinos principais, ambos os perfis, busca/status/datas do Banco, detalhes/assinaturas e CSV, cadastro/edição de frota e QR, funcionários/motoristas/timeline, inspeção completa, assinatura obrigatória/limpeza/troca de motorista/consulta, devolução legada, Cobli associado/sem associação, seis fotos, visitante/funcionário, conferência, logout e proteções de ambiente/service worker.

Há dez referências de screenshot, cinco páginas em cada tamanho, em `.cache/visual-baselines`. Imagens para inspeção ficam em `.cache/visual-audit`. As referências foram criadas para a interface restaurada e depois comparadas em nova execução, sem atualização automática. Também foram verificados gradiente original, cor ativa do menu, logo, glass, decoração e ausência de transbordamento horizontal.

Não existia baseline visual histórico certificado. A comparação com o original foi feita pelo código/estilos Git e inspeção das imagens atuais; não se declara igualdade de pixels com uma execução histórica. O código antigo não foi iniciado, evitando reativar autenticação insegura ou endereços antigos.

## Arquivos principais desta revisão

- `src/App.tsx`, `src/index.css`, `src/demo/DemoProvider.tsx`: identidade, navegação, perfis de demonstração e acesso às telas.
- `UnifiedPortaria.tsx`, `CompanyDepartureForm.tsx`, `MovementHistory.tsx`, `DepartureSummary.tsx`: fluxos, formulários, cards, filtros, histórico e assinatura.
- `OperationalView.tsx`, `DatabaseView.tsx`, `InspectionBell.tsx`, `SignaturePad.tsx`, `Modal.tsx`, `Login.tsx`, `VehiclesView.tsx`: reutilização e ajustes dos componentes anteriores.
- `src/domain/demoStore.ts`, `portaria.ts`, `reporting.ts` e serviços de pessoas/veículos/operações/inspeções: simulação, validações e integração de indicadores.
- `tests/interface-regression.test.ts`, `tests/browser/interface-regression.spec.ts`, testes de saída/SQL e `playwright.config.ts`: regressões funcionais, visuais e de segurança.
- Candidato local `003_operations.sql`: assinatura e informações complementares de novas operações, sem execução remota.

## Revisão manual ainda necessária

1. Confirmar fidelidade visual e organização com os responsáveis pelo uso diário. Testar ambos os perfis na aplicação local, incluindo menus e campos complementares.
2. Validar assinatura por toque, câmera traseira/permissões e documentos artificiais em aparelhos reais; emulação Pixel não substitui Android/iOS físicos. Acesso em dispositivo externo depende de origem HTTPS autorizada futura; não foi aberto servidor na rede local.
3. Conferir impressão física, etiquetas QR, downloads e planilhas no navegador/Excel utilizados pela equipe. A geração local foi preservada; não foi acionada impressora real.
4. Avaliar uso de informação complementar de autorização e motorista do retorno, sem sobrescrever histórico nem confundir declaração com permissão do sistema.
5. Após backup/restauração e aprovação específica, validar Auth/JWT, RLS, Storage, Realtime e preservação dos dados no ambiente gerenciado. Demonstração não comprova integração remota.

## Acesso para revisão

`http://127.0.0.1:5173/` utiliza o processo Vite existente em modo **demo**. Atualizar a página e selecionar **Simular administrador** ou **Simular porteiro**. Nenhuma credencial é necessária. Usar exclusivamente dados/documentos fictícios; recarregar descarta as alterações da simulação.

Verificação final por navegador automático: HTTP 200, demo confirmado, seis entradas de menu, três veículos disponíveis no cenário inicial e zero requisições externas. O processo existente foi mantido em loopback; os servidores de teste nas portas 5273/5274 foram encerrados. Branch `desenvolvimento` confirmada, diff sem erros de whitespace e arquivos históricos de migrations sem alteração. `scripts/check-local-preview.mjs` permite repetir a verificação somente local, sem iniciar servidor.

Se o processo for encerrado posteriormente, o comando autorizado para a demonstração é `npm run dev`. Não usar `dev:original` como atalho de revisão visual nem liberar o original nesta etapa.
