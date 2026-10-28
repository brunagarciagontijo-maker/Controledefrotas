# Entrega da Fase 1 — Sistema Portaria

> **Histórico da estratégia anterior.** Em 27/10/2026 a estratégia mudou para atualização do Supabase original. Consulte `ORIGINAL_IMPLEMENTATION.md`, `ORIGINAL_ACCESS.md` e `ORIGINAL_RELEASE.md` para o estado atual. Não seguir a criação de DEV indicada neste relatório histórico.

Implementação local na branch `desenvolvimento`. O projeto Supabase DEV ainda não existe. Nenhum SQL foi aplicado remotamente, nenhum dado de produção foi acessado e nenhum commit, push, merge ou deploy foi realizado.

## Checklist de situação

| Entrega | Situação | Evidência / limite |
|---|---|---|
| Perfil exclusivo `devcloud` e bloqueio antes da conexão | Concluído localmente | Validação no Vite e no navegador; sem configuração, somente tela de preparo |
| Projeto, chave pública e origem local fixados | Concluído localmente | Identificador e hash em arquivo ignorado; destino legado conhecido bloqueado |
| Login hardcoded e privilégios de `localStorage` substituídos | Concluído localmente | Supabase Auth, RPC de perfil próprio, administrador/porteiro/inativo/sem perfil |
| Tratamento de sessão, logout e acesso negado | Concluído localmente | Sessão do próprio DEV; logout fecha a interface antes da chamada remota |
| RLS, privilégios e Storage privado | Concluído e testado em PostgreSQL em memória | Aplicação e validação nos serviços Supabase ainda pendentes |
| Pacote SQL para banco vazio | Concluído localmente | Sete lotes em `supabase/dev`; bloqueios de ambiente e reaplicação |
| 21 migrations originais | Preservadas | Hashes do histórico conferidos por teste; nenhuma alteração na pasta |
| Dados e arquivos exclusivamente fictícios | Concluído localmente | Fixtures, PNG geométrico e PDF marcado SEM VALIDADE |
| Documentos/fotos privados e links temporários | Implementado; integração parcial | Política e caminhos testados; assinatura/upload reais aguardam projeto DEV |
| Pátio, autoria e checklist transacionais | Concluído e testado localmente | Triggers no servidor; rejeição de retiradas duplicadas nos dois fluxos |
| Service worker desativado no DEV | Concluído localmente | Teste de remoção apenas do worker local deste app; preservação de cache alheio |
| Dependências e execução local | Concluído localmente | Lint, TypeScript, testes, build e auditoria npm |
| Projeto, Auth, Storage e Realtime na nuvem | Pendente de ação manual | Roteiro completo em `DEV_SETUP.md` |
| Configurações externas GitHub/Netlify | Não verificadas nem alteradas | Nenhum push; build recusa ambiente Netlify e modos diferentes de DEV |
| Melhorias funcionais da fase seguinte | Pendentes, deliberadamente | Não foram inventadas novas regras Cobli/fotos obrigatórias |

## Verificações executadas

- `npm run check`: lint sem erros, TypeScript da aplicação/configuração/scripts/testes sem erros, **49 testes aprovados**, build Vite concluído.
- `npm run test:browser`: **6 testes aprovados**, Chrome instalado, cenários desktop e Pixel 7 emulado. Verificados bloqueio sem configuração, ausência de conexões externas, flags antigas sem efeito, ausência de overflow horizontal e limpeza limitada do worker/cache.
- Testes do banco: PostgreSQL PGlite em memória, execução dos lotes de estrutura/permissões/Storage/perfis/fixtures/validação, simulação de papéis e `auth.uid()`, rollback por caso e publicação Realtime em catálogo. Não emulam os serviços HTTP de Auth, Storage ou Realtime.
- `npm ls --depth=0`: árvore instalada sem inconsistências reportadas.
- Auditoria npm: nenhuma vulnerabilidade reportada na consulta realizada. Isso não constitui garantia de ausência de falhas no código.
- `git diff --check`: sem erros de whitespace. Teste de integridade confirmou as 21 migrations originais.
- Nenhum `.env.devcloud.local` ou destino DEV real foi criado. Os servidores de teste são encerrados ao final.

Versões principais instaladas: Node.js 24.11.1, React 18.3.1, TypeScript 5.9.3, Vite 8.3.5, Supabase JS 2.118.0. TypeScript 5.9 foi escolhido pela compatibilidade declarada com as ferramentas de lint; React 18 foi mantido. Os testes de navegador utilizam Chrome/Edge existente, sem download automático de navegador.

## Arquivos criados

- Entrada e documentação: `README.md`, `DEV_SETUP.md`, `PHASE1_STATUS.md`, `devcloud.target.example.json`.
- Ambiente e segurança: `src/config/blockedProjects.ts`, `src/lib/environment.ts`, `src/lib/runtime.ts`, `src/lib/devServiceWorker.ts`, `src/lib/privateFiles.ts`, `src/utils/html.ts`, `src/utils/signature.ts`.
- Autenticação: `src/auth/AuthProvider.tsx`, `src/auth/context.ts`, `src/auth/authorization.ts`.
- Interface de preparo/arquivos: `src/components/EnvironmentSetup.tsx`, `src/components/PrivatePhotos.tsx`.
- Ferramentas locais: `scripts/configure-dev.ts`, `scripts/prepare-dev-sql.ts`, `scripts/generate-demo-assets.mjs`, `scripts/start-offline.mjs`, `tsconfig.tools.json`.
- Banco: `supabase/dev/01_schema.sql` até `07_realtime.sql`, `supabase/dev/history-manifest.json`, `supabase/dev/README.md`, `supabase/dev/assets/documento-teste.pdf`, `supabase/dev/assets/foto-teste.png`.
- Testes: `tests/environment.test.ts`, `tests/authorization.test.ts`, `tests/database.test.ts`, `tests/repository.test.ts`, `tests/browser/setup.spec.ts`, `tests/browser/global-setup.ts`, `playwright.config.ts`.

## Arquivos alterados

- Configuração: `.gitignore`, `.env.example`, `package.json`, `package-lock.json`, `eslint.config.js`, `vite.config.ts`, `src/vite-env.d.ts`, `index.html`, `public/sw.js`.
- Inicialização/contratos: `src/main.tsx`, `src/App.tsx`, `src/lib/supabase.ts`, `src/types/database.ts`.
- Telas: `Login`, `AccessControlView`, `DatabaseView`, `InspectionBell`, `OperationalView`, `PWAInstallPrompt`, `RecordDetails`, `SignaturePad`, `VehicleForm`, `VehiclesView` em `src/components`.
- Serviços: `accessControlService`, `inspectionService`, `operationalService`, `reportService`, `vehicleCatalogService`, `vehicleService` em `src/services`; exportação em `src/utils/export.ts`.
- Legados: `test-supabase.mjs` foi aposentado sem destino remoto; `SUPABASE_SETUP.md`, `INTEGRACAO_SUPABASE.md` e `PWA_SETUP.md` apontam para o guia atual. `arquivo.md` e `supabase/database.sql` receberam aviso de histórico inadequado para preparar este DEV.

Dependências instaladas, artefatos de build, caches npm e screenshots ficam em diretórios ignorados. Nenhum segredo foi incluído no relatório ou nos exemplos.

## Correções relevantes

Removidos destino Supabase fixo e credenciais de login do código ativo. O cliente só é criado após validação, aceita chamadas ao destino aprovado e usa sessão própria do DEV. QR e URLs de arquivos recusam destinos externos; assinaturas só aceitam imagens inline permitidas. Impressão escapa HTML e exportação CSV trata fórmulas.

O banco novo substitui políticas públicas do histórico por acesso autenticado e perfil ativo. Perfis ficam no esquema privado, sem escrita pelo aplicativo; porteiro não recebe gestão da frota/cadastros, exclusões físicas ou autoatribuição de privilégios. Autoria de operações e inspeções é resolvida no servidor. Disponibilidade e checklist deixam de depender de múltiplas chamadas HTTP independentes.

Uploads usam MIME/tamanho permitidos e buckets privados. O banco armazena caminhos, e links são assinados por dez minutos. Falhas de fotos preservam a movimentação salva e tentam compensar uploads; banco e Storage não formam uma única transação. Objetos órfãos ainda podem exigir conferência administrativa se a compensação também falhar.

## Ações que dependem de você

Siga a ordem exata e os critérios de parada em [DEV_SETUP.md](DEV_SETUP.md):

1. Criar projeto vazio independente, verificar organização/permissões/plano/cotas e desligar Data API/cadastros abertos durante a preparação. Não configurar integrações de publicação.
2. Gerar os SQLs com `npm run dev:sql -- --project-ref IDENTIFICADOR_DEV` e aplicar manualmente os lotes 01–03, conferindo o identificador do painel antes de cada lote.
3. Criar quatro contas artificiais diretamente em Auth, sem envio de email. Preencher os três UUIDs no lote gerado 04 e aplicá-lo; manter a quarta conta sem perfil.
4. Aplicar fixtures 05 e subir os dois arquivos demonstrativos nos três caminhos exatos documentados.
5. Executar 06, revisar Security Advisor, buckets e exposição de esquemas; configurar Auth para `http://127.0.0.1:5173/` e então habilitar Data API.
6. Executar `npm run dev:configure` no terminal e informar somente os dados públicos do novo DEV na entrada local. Não enviar senhas ou chaves ao chat. Executar verificações e `npm run dev`.
7. Validar login/recusa/logout e operações pelos quatro perfis. Depois aplicar 07 e testar inspeções entre duas sessões.

Critério de conclusão integrada: contas sem autorização não acessam dados; porteiro não amplia privilégios; administração e operações permitidas funcionam; arquivos permanecem privados e temporários; Realtime respeita RLS. Havendo falha, parar a validação e seguir a recuperação do guia, sem abrir políticas públicas.

## Próxima fase

Após a validação integrada do DEV, iniciar a unificação de Pátio e Registro em incrementos pequenos. Definir antes as regras de associação Cobli, fotos condicionais de veículos/documentos, dispensa de motivo para funcionários e conferência física. A separação atual entre ambiente, autenticação, serviços, arquivos e SQL fornece a base; a interface operacional existente ainda exige avaliação completa em dispositivo móvel real.

Não há evidência local das regras de auto publicação do GitHub/Netlify. Antes de qualquer push futuro, conferir manualmente branches, hooks, previews e variáveis dessas plataformas. O bloqueio de build é uma proteção adicional; não comprova a configuração externa.
