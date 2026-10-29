# Sistema Portaria

[Plano vigente: integração original sem backup](ORIGINAL_SIMPLIFIED_DEPLOY.md). O usuário dispensou backup completo/laboratório e aceitou risco de perda dos históricos. Instalações de WSL/Docker/clientes de backup estão suspensas; SQL, Storage/Auth/RLS e publicação continuam sujeitos a autorização específica. Os planos de backup anteriores são referência histórica.

**Estado atual:** pacote **001–007, contrato original 5**, incluindo controle de óleo. A usuária confirmou a aplicação manual no original; postflights, integridade e preservação histórica foram comparados localmente. Consulte [FINAL_INSTALL.md](FINAL_INSTALL.md) para as evidências e limites. Os relatórios anteriores representam estágios históricos.

Frontend React/TypeScript com Supabase, preservando registros, documentos privados e identidade visual. **Nesta etapa somente a configuração de CI e o staging foram autorizados; commit, push, merge e deploy aguardam confirmação.**

Registro está integrado ao Pátio; Cobli, assinaturas, documentos, Encomendas e históricos permanecem preservados. Os refinamentos incluem Gestão, listas responsivas, conferência física diária, controle de óleo e Timeline completa.

Com as dependências já disponíveis e Node.js 24 ou superior:

```powershell
npm run dev
```

Abre uma demonstração com dados fictícios em memória em `http://127.0.0.1:5173`. Não cria cliente Supabase, não usa credenciais e perde as alterações ao recarregar. A demonstração cobre os fluxos de portaria; não simula todas as operações administrativas dos cadastros antigos.

```powershell
npm run check
npm run test:browser
npm run build:demo
```

Os testes SQL usam PostgreSQL WASM em memória. O navegador usa Chrome/Edge já instalado, sem download automático. Docker, WSL e Supabase CLI não são necessários. Os scripts acima não aplicam migrations nem publicam o sistema.

- [Relatório da implementação e pendências](ORIGINAL_IMPLEMENTATION.md).
- [Auditoria e restauração visual/funcional](UI_REGRESSION_AUDIT.md).
- [Revisão dos três inventários e decisão de implantação](ORIGINAL_PREDEPLOY_REVIEW.md).
- [Procedimento de backup e restauração verificáveis](ORIGINAL_BACKUP_RUNBOOK.md).
- [Inventário somente leitura](ORIGINAL_ACCESS.md).
- [Backup, aprovação, atualização e recuperação](ORIGINAL_RELEASE.md).
- [SQLs incrementais e referências históricas](supabase/original/README.md). Não reaplicar automaticamente no banco existente.

`original:configure` fixa o destino local inicialmente em metadata-only. A liberação original exige evidências/dispensa registrada, SQL aprovado/aplicado, validação e autorização do aplicativo. Nenhum script de build aplica migrations.

[Configuração de deploy automático Netlify](NETLIFY_AUTODEPLOY.md): site existente `controledeportariagontijo.netlify.app`, produção somente em `main`; `desenvolvimento` e previews não publicam o projeto original. O CI exige variáveis explícitas e o contrato público pinado, sem arquivos privados locais. A configuração externa e a publicação ainda precisam de conferência/autorização.

`DEV_SETUP.md`, `supabase/dev` e as 21 migrations históricas são referências anteriores. **Não execute esses pacotes nem `supabase/database.sql` no projeto original.**
