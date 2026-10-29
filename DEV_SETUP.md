# Preparação operacional do Supabase DEV

> **Estratégia substituída em 27/10/2026.** Não crie nem prepare um projeto DEV por este guia agora. Use `ORIGINAL_ACCESS.md` e `ORIGINAL_RELEASE.md`. Nunca aplique o pacote DEV no Supabase original. O conteúdo abaixo permanece como referência histórica e para testes locais em memória.

## Estado e limites

O código e o pacote SQL podem ser preparados e testados sem projeto remoto. A autenticação, Storage e Realtime gerenciados precisam de validação posterior no projeto novo. Os testes locais não criam projetos, usuários remotos ou conexões de produção.

O frontend aceita somente o projeto fixado nos arquivos locais. O cadastro desse destino depende da confirmação humana de que ele é novo e independente: uma chave pública não comprova, sozinha, que um projeto é DEV. O destino legado conhecido também é bloqueado por uma impressão digital, sem manter seu endereço ou chave no código ativo.

## 1. Criar o projeto — ação manual

1. Entre no painel Supabase com sua própria conta e proteja o acesso ao painel com MFA.
2. Confira a organização, quem terá acesso, região, plano, cotas e estimativa de cobrança. Não altere plano ou permissões da organização de produção. Prefira organização DEV separada quando necessário para restringir colaboradores.
3. Crie um projeto vazio com nome identificável, por exemplo `Sistema Portaria DEV`. Não clone nem restaure outro projeto.
4. Guarde a senha do banco em gerenciador de senhas. Ela não é necessária para os comandos locais deste guia e não deve ser enviada ao Codex.
5. Copie apenas o identificador público do novo projeto, conferindo a URL do painel. Não basta conferir o nome visível.
6. Em Data API, mantenha **Enable Data API desativado** durante a preparação. Revise também exposição automática de tabelas/esquemas. Storage e Realtime têm controles independentes.
7. Em Auth, desative cadastro aberto e anonymous sign-ins. Mantenha apenas email/senha para este primeiro conjunto de testes.
8. Não configure integrações GitHub, deploy hooks, branching automático ou Netlify nesta fase.

Preços, disponibilidade de projetos, recursos de acesso por projeto e quotas dependem da organização/plano. Confira antes de criar: [preços](https://supabase.com/pricing), [custos](https://supabase.com/docs/guides/platform/cost-control), [acesso ao painel](https://supabase.com/docs/guides/platform/access-control). O spend cap cobre itens específicos; não equivale a teto universal da fatura.

## 2. Preparar os SQLs — comando local, sem rede

```powershell
npm run dev:sql -- --project-ref IDENTIFICADOR_DEV_DE_20_CARACTERES
```

Use o identificador real do projeto DEV, não o texto ilustrativo. O comando escreve `.cache/devcloud-sql`, ignorado pelo Git. Não executa SQL e não faz login em serviços.

Os templates versionados ficam em `supabase/dev`. Nunca execute `supabase/database.sql` ou as 21 migrations históricas para preparar este DEV. O pacote novo elimina os cadastros nominativos e políticas públicas do histórico.

## 3. Aplicar estrutura e permissões — ação manual no SQL Editor

Antes de **cada** lote, confira o identificador na URL do painel. Use o SQL Editor administrativo somente no projeto DEV. O nome do banco `postgres` não distingue ambientes.

Abra os arquivos gerados e execute, um por vez:

1. `01_schema.sql`: banco vazio, marcador DEV, funções, sequências, 10 tabelas, índices, relacionamentos e RLS inicialmente sem acesso operacional.
2. `02_security.sql`: perfis protegidos, privilégios mínimos, políticas, autoria no servidor, disponibilidade e checklist transacionais.
3. `03_storage.sql`: três buckets privados, limite de 10 MB, formatos permitidos e políticas por perfil/entidade.

Cada lote usa transação. Em caso de erro, pare; não execute o seguinte nem remova o bloqueio por tentativa. O primeiro lote recusa sobrescrever as tabelas do sistema; os seguintes exigem o marcador do mesmo projeto.

Não edite esquemas internos de Auth/Storage nem desative RLS para fazer operações funcionarem. O pacote não instala nem substitui os serviços gerenciados.

## 4. Criar quatro contas artificiais — ação manual em Auth

Em **Users**, utilize criação direta de usuário, com email confirmado. Não use convites e não envie mensagens. Escolha senhas próprias; não coloque senhas no SQL, Git ou chat.

| Conta de teste | Identificador ilustrativo | Perfil |
|---|---|---|
| Administrador | `admin.dev@example.invalid` | `admin`, ativo |
| Porteiro | `porteiro.dev@example.invalid` | `porteiro`, ativo |
| Inativo | `inativo.dev@example.invalid` | `porteiro`, inativo |
| Sem perfil | `semperfil.dev@example.invalid` | Nenhum |

O domínio `.invalid` é demonstrativo. Se o painel recusar a criação, interrompa esse passo e informe o erro sem dados da conta; não substitua automaticamente por email pessoal.

Copie os UUIDs das três primeiras contas. No arquivo **gerado** `04_test_profiles.sql`, substitua `REPLACE_ADMIN_USER_UUID`, `REPLACE_GATE_USER_UUID` e `REPLACE_INACTIVE_USER_UUID`. Execute esse lote. O quarto usuário não recebe linha de perfil.

O perfil está no esquema `private` e não pode ser autoatribuído pelo aplicativo. Em DEV, gestão da frota/cadastros e exclusões físicas ficam com administrador; porteiro consulta e executa operações, cadastra visitantes/terceirizados e conclui inspeções. Ajustes finos desta matriz devem ser discutidos antes da próxima fase.

## 5. Dados e arquivos fictícios — ação manual

Execute `05_fixtures.sql` uma vez. Ele recusa mesclar dados com tabelas já preenchidas.

Inclui oito pessoas artificiais, seis veículos, veículo pessoal, retiradas, devoluções, movimentações, checklists, acessos de pessoas e inspeções. Datas de demonstração usam setembro/outubro de 2026; os indicadores de atraso dependem da data em que o aplicativo é aberto. As assinaturas são imagens geométricas, sem autoria humana.

Os arquivos demonstrativos já estão em `supabase/dev/assets`. Para reproduzi-los localmente:

```powershell
npm run dev:assets
```

No painel Storage, mantendo todos os buckets privados, envie somente estes arquivos:

| Bucket | Arquivo local | Caminho completo dentro do bucket |
|---|---|---|
| `person-documents` | `documento-teste.pdf` | `10000000-0000-4000-8000-000000000002/documento-teste.pdf` |
| `access-documents` | `documento-teste.pdf` | `10000000-0000-4000-8000-000000000006/documento-teste.pdf` |
| `vehicle-operation-photos` | `foto-teste.png` | `50000000-0000-4000-8000-000000000001/saida/foto-teste.png` |

Use as pastas indicadas. Os registros SQL já apontam para esses caminhos; não há URLs públicas para copiar. Não utilize o bucket legado de CNH.

## 6. Validar e liberar API — ação manual

1. Execute `06_validate.sql`. O resultado esperado é `Estrutura DEV verificada`.
2. Confira no painel os três buckets privados, limites e formatos; revise os achados do Security Advisor sem dispensar alertas automaticamente.
3. Em Auth > URL Configuration, configure Site URL e redirect permitido para `http://127.0.0.1:5173/`. Não inclua endereços de produção ou curingas para domínios desconhecidos.
4. Habilite Data API somente após a revisão das políticas. Mantenha exposto somente o esquema necessário ao app; `private` não deve ser exposto.

Há uma RPC anônima limitada, `get_dev_environment`, que retorna somente identificador, ambiente e versão do schema. Ela permite reconhecer a preparação DEV sem divulgar dados operacionais. As tabelas permanecem bloqueadas para anônimos; `get_my_profile` exige autenticação e retorna somente o perfil do próprio usuário.

SQL Editor administrativo contorna RLS. O resultado de `06_validate` não substitui testes com os usuários da aplicação.

## 7. Configurar o frontend — comando local interativo

Em Connect/API Keys do mesmo projeto DEV, obtenha a Project URL e uma **publishable key**. Nunca utilize secret key ou `service_role`; o SDK não necessita da senha do banco.

```powershell
npm run dev:configure
```

O comando pede confirmação `DEV NOVO`, identificador e chave pública em entrada oculta. Não faz conexão. Cria:

- `.env.devcloud.local`: as três variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_PUBLIC_APP_URL`;
- `devcloud.target.local.json`: identificação, origem local, hash da chave e liberação explícita do projeto DEV.

Os dois arquivos são ignorados pelo Git. O nome `ANON_KEY` é mantido por compatibilidade da aplicação, mas aceita a publishable key atual. JWT legado só é aceito quando declara `anon`, referencia o projeto fixado e não está vencido. Nenhuma chave administrativa é aceita.

Não compartilhe os arquivos locais. As variáveis `VITE_` são entregues ao navegador; somente valores públicos podem estar nelas. Variáveis herdadas do terminal também são validadas e podem causar bloqueio se divergirem.

## 8. Executar e validar os usuários — ação local e testes DEV

```powershell
npm run check
npm run test:browser
npm run dev
```

Abra `http://127.0.0.1:5173`. A porta é fixa; se estiver ocupada, o servidor para em vez de migrar silenciosamente para outro endereço.

| Tentativa | Resultado esperado |
|---|---|
| Sem login | Somente login; nenhum dado operacional |
| Administrador | Cadastros, consulta, operações e gestão autorizada |
| Porteiro | Operações e consultas; gestão/exclusões bloqueadas |
| Inativo ou sem perfil | Tela de acesso bloqueado |
| Flags antigas no `localStorage` | Não concedem acesso |
| Alterar projeto, origem ou chave sem atualizar aprovação local | Bloqueio anterior à conexão |
| QR de outro ambiente | Rejeitado |
| Documento/foto | URL temporária privada, somente do DEV |
| Retirada duplicada nos dois fluxos | Rejeitada no servidor |
| Logout | Fecha a área autenticada e limpa somente a sessão deste DEV |

Perfis são revalidados ao focar a janela e periodicamente. O servidor avalia o perfil ativo nas operações independentemente da interface. Não use contas administrativas de painel para avaliar RLS pelo SQL Editor.

## 9. Realtime — ação manual após testes de acesso

Execute `07_realtime.sql` para adicionar somente `vehicle_inspection_requests` à publicação `supabase_realtime`. Alternativamente, habilite apenas essa tabela no painel Publications.

Entre como administrador em uma sessão e porteiro em outra. Solicite inspeção no cadastro de veículos; confira notificação e conclusão, autoria e atualização. Usuários inativos/sem perfil não podem receber dados operacionais.

Essa validação usa o serviço gerenciado e continua pendente enquanto o projeto não existir. Os testes locais validam o SQL e a publicação, sem emular o servidor WebSocket ou o serviço de autenticação.

## Recuperação segura

1. Pare o frontend se houver dúvida sobre destino/configuração.
2. No projeto DEV conferido, desative Data API e retire inspeções da publicação se necessário. Storage é independente: mantenha buckets privados e bloqueie perfis afetados.
3. Não restaure políticas públicas para contornar erros. Links de arquivo já assinados podem permanecer válidos por até dez minutos; a desativação da Data API não revoga esses links.
4. Em lote SQL com falha, confirme rollback antes de continuar. Após commit, não há rollback automático de alterações externas ou uploads.
5. Remova arquivos somente pela interface/API Storage, não por exclusão manual de linhas em `storage.objects`.
6. Para recomeçar do zero, a opção mais previsível é outro projeto DEV vazio, mediante decisão explícita de criação/exclusão e custos. Nunca use reset genérico, restauração de produção ou execução cega das migrations antigas.
7. Um novo projeto terá outra identificação/chave: gere os SQLs para ele e refaça `dev:configure`. Custos já incorridos não são automaticamente cancelados por rollback.

O pacote inicial não é reaplicável sobre banco preenchido. Isso é uma proteção, não um mecanismo automático de atualização. Futuras evoluções precisam de migrations incrementais próprias e revisão antes de qualquer promoção.

## Limitações e próximos passos

- Login, URLs assinadas e Realtime reais aguardam o painel DEV e testes integrados.
- Upload e banco são serviços distintos. O movimento/checklist/disponibilidade são transacionais; falhas de fotos preservam a movimentação e tentam limpar objetos novos. Confira o registro antes de repetir a operação.
- O perfil DEV não registra PWA. Remove apenas eventual worker `/sw.js` deste app na origem local e o cache exato `frotas-v1`, sem limpeza indiscriminada.
- `build` e `preview` são DEV; `NETLIFY` e modos diferentes são recusados. Não existe deploy nesta fase.
- QR local e emulação móvel não comprovam câmera ou acesso a partir de outro celular. Uma origem de testes móveis será planejada separadamente.
- Autorização mais granular, Cobli, novas obrigatoriedades e unificação dos fluxos estão fora desta fase.
