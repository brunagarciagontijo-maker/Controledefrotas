# Publicação automática no site existente

Destino: https://controledeportariagontijo.netlify.app/
Repositório: https://github.com/brunagarciagontijo-maker/Controledefrotas

## Estado e limites desta preparação

Configuração preparada localmente. Nenhum commit, push, merge, alteração no painel Netlify ou deploy foi executado nesta etapa. Supabase, Auth, RLS, Storage e os SQLs 001–007 não foram alterados.

Adaptação para o novo site validada localmente: lint, TypeScript, 233 testes automatizados e `npm run build` com contexto production/main simulado passaram. O artefato iniciou na origem nova em desktop/celular, com API interceptada, e recusou a origem antiga antes de consultar o marcador. Nenhuma sessão Auth real ou conexão remota foi utilizada. O build permanece em `dist`, ignorado pelo Git; o painel Netlify ainda exige conferência externa.

`main` será a branch de produção; `desenvolvimento` permanece separada. A consulta remota confirmou `main` e ainda não encontrou `desenvolvimento`. Não trocar branches nem sobrescrever o trabalho local para preparar o primeiro commit.

## Guardas do build

- `netlify.toml`: comando `npm run build`, Node 24, saída `dist`, reescrita SPA e origem HTTPS fixa no contexto production. `build:original` e `build:netlify` são aliases; `build:dev` continua usando explicitamente devcloud.
- `scripts/netlify-ignore.mjs`: cancela builds de desenvolvimento, branch deploys e previews. Apenas production/main prossegue.
- `scripts/netlify-production.ts`: exige NETLIFY=true, CONTEXT=production, BRANCH=main, PULL_REQUEST=false, SITE_NAME/URL do site existente e REPOSITORY_URL do repositório transferido. O build recusa preview servers, outro site/repositório e contextos incompletos.
- Projeto Supabase original e chave pública são conferidos por SHA-256; contrato 5 e os sete templates SQL permanecem pinados. Chaves concatenadas ou administrativas são recusadas. Nenhuma migration é executada pelo build.
- No CI, Vite usa apenas as três variáveis explícitas e desabilita leitura de dotenv. Não precisa de original.target.local.json, inventários, recibos ou outros arquivos privados.
- `netlify/production-contract.json` contém somente configuração pública e fingerprints de aprovação: origem, repositório, contrato e hashes. Não contém chave, senha, usuário, registro pessoal ou conteúdo de inventários. Alterar destino, chave ou migrations exige revisão explícita desse contrato; não existe fallback automático.
- O artefato recebe `_headers` com CSP limitada ao próprio site e Supabase pinado, bloqueio de frames e restrições de câmera/microfone. Sem source maps. A chave anon é pública e necessariamente integra o JavaScript; service_role e outros segredos nunca podem integrar o cliente.

## Configurações do painel a conferir antes de autorizar push

No **site Netlify existente**, conferir acesso da integração GitHub ao novo repositório. Não criar outro site nem alterar seu nome/URL.

1. Confirmar branch de produção `main` e diretório-base na raiz do repositório.
2. Desativar branch deploys e Deploy Previews para esta primeira publicação. As guardas no repositório também os bloqueiam.
3. Manter builds/publicação pausados até a revisão e autorização de publicação. Conferir webhooks e integrações herdadas da transferência antes do primeiro push.
4. Configurar no contexto **Production**, com escopo de build:
   - `VITE_SUPABASE_URL`: URL HTTPS exata do projeto original aprovado.
   - `VITE_SUPABASE_ANON_KEY`: somente a chave pública anon aprovada completa, sem concatenação.
   - `VITE_PUBLIC_APP_URL`: https://controledeportariagontijo.netlify.app (já fixada em netlify.toml).
5. Não adicionar service_role, senha PostgreSQL, tokens de administração ou outras variáveis VITE_. Nenhum token Netlify precisa ser incluído no repositório ou usado pelo frontend.
6. Não redefinir as variáveis de plataforma NETLIFY, CONTEXT, BRANCH, PULL_REQUEST, SITE_NAME, URL e REPOSITORY_URL. O build verifica os valores fornecidos pela plataforma.

As configurações externas do painel, permissões da integração e direito de push não foram comprovados pela consulta Git somente leitura.

## Sequência após as autorizações específicas

1. Revisar diff staged e varredura de segredos. Confirmar que fontes, templates, testes, package-lock e este contrato público estão incluídos; arquivos privados ficam ignorados.
2. Autorizar commit e push somente de `desenvolvimento`, sem force push. Comando de push previsto: `git push -u origin desenvolvimento`.
3. Preparar PR de desenvolvimento para main. Executar build/checagens adicionais quando autorizados; não promover nem publicar em caso de falha.
4. Aprovar explicitamente o merge e a ativação do deploy automático de main no site existente. Não usar um push direto para main como substituto da revisão.
5. Após a publicação autorizada, validar HTTPS, login dos perfis indicados, navegação, QR e leitura de documentos privados, sem criar/alterar registros reais.

Nunca usar os arquivos intermediários de `.cache/netlify-review` como configuração do CI. Eles não são versionados e a preparação manual anterior foi interrompida. O caminho automático utiliza exclusivamente os arquivos e guardas descritos acima.
