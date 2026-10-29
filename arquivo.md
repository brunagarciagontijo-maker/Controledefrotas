# Referencia historica ? nao utilizar para configurar o DEV

Este documento descreve a versao anterior. Autenticacao local, instrucoes SQL e procedimentos de ambiente abaixo estao obsoletos. Utilize [DEV_SETUP.md](DEV_SETUP.md) e [README.md](README.md).

---

# Documentacao do Sistema de Controle de Frotas

## 1. Visao geral
Este sistema e uma aplicacao web para controle de retirada e devolucao de veiculos da frota, com assinatura digital no momento da retirada e da devolucao.

Principais objetivos:
- Registrar retiradas com dados obrigatorios e assinatura.
- Registrar devolucoes no mesmo registro.
- Consultar, filtrar, editar e excluir registros.
- Cadastrar e gerenciar veiculos da frota.
- Gerar relatorios e exportacoes (CSV/"Excel").
- Exibir indicadores no dashboard.
- Funcionar como PWA (instalavel).

## 2. Stack e arquitetura
### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Lucide React (icones)

### Backend/Data
- Supabase (PostgreSQL + API)
- Cliente: `@supabase/supabase-js`

### Estrutura funcional
- `src/App.tsx`: roteamento interno por abas e autenticacao local.
- `src/components`: telas e componentes reutilizaveis.
- `src/services`: regras de acesso a dados e calculos.
- `src/utils`: formatacao e exportacao.
- `supabase`: SQL e migracoes.
- `public`: manifest e service worker da PWA.

## 3. Modulos do sistema
### 3.1 Login
- Tela de login local (`src/components/Login.tsx`).
- Credenciais fixas no codigo:
  - Usuario: `admingontijo`
  - Senha: `admin123`
- Estado autenticado salvo em `localStorage` (`isAuthenticated=true`).

### 3.2 Registro (Retirada/Devolucao)
Componente: `src/components/VehicleForm.tsx`

Fluxos:
- Novo registro (retirada):
  - Campos obrigatorios: veiculo, motivo, autorizacao, data/hora retirada, nome retirada, assinatura retirada.
  - Selecao de veiculo com pesquisa por placa, nome ou responsavel.
  - Status salvo como `Em uso`.
- Devolucao:
  - Ocorre sobre registro existente em `Em uso`.
  - Campos obrigatorios: data/hora devolucao, nome devolucao, assinatura devolucao.
  - Status atualizado para `Devolvido`.

Regras importantes:
- Assinaturas sao capturadas em canvas e salvas em Base64 (JPEG).
- Dados de retirada ficam bloqueados no modo devolucao para preservar historico.

### 3.3 Banco de dados (consulta operacional)
Componente: `src/components/DatabaseView.tsx`

Recursos:
- Busca por placa/nome.
- Filtro por status (`Todos`, `Em uso`, `Devolvido`).
- Filtro por periodo (data inicial/final).
- Acoes por registro: visualizar, editar/devolver, excluir.
- Exportacao:
  - CSV de registros.
  - CSV formatado para uso em Excel com utilizacao diaria.
  - Impressao de relatorio.

### 3.4 Dashboard
Componente: `src/components/Dashboard.tsx`

Indicadores:
- Veiculos utilizados no periodo.
- Total devolvido.
- Tempo medio de uso.
- Alertas de veiculos com possivel atraso (7+ dias).
- Ranking de veiculos mais utilizados.
- Motivos de uso.
- Usuarios mais ativos.

Filtros de periodo:
- Dia, semana, mes e personalizado.

### 3.5 Gestao de veiculos
Componente: `src/components/VehiclesView.tsx`

Recursos:
- CRUD de veiculos da frota.
- Campos: placa, nome, responsavel/motorista, status.
- Status possiveis: `Ativo`, `Inativo`, `Em Manut.`
- Busca e filtro por status.

## 4. Modelo de dados
### 4.1 Tabela `vehicle_records`
Finalidade: registrar movimentacoes de retirada/devolucao.

Campos principais:
- `id` (uuid, PK)
- `vehicle_plate` (text)
- `reason` (text)
- `authorized_by` (text)
- `usage_type` (text, snapshot do tipo de uso no momento da retirada)
- `pickup_date` (date)
- `pickup_time` (time)
- `pickup_name` (text)
- `pickup_signature` (text, Base64)
- `return_date` (date, nullable)
- `return_time` (time, nullable)
- `return_name` (text, nullable)
- `return_signature` (text, nullable)
- `observations` (text)
- `status` (`Em uso` | `Devolvido`)
- `created_at` / `updated_at` (timestamptz)

### 4.2 Tabela `vehicles`
Finalidade: cadastro mestre da frota.

Campos principais:
- `id` (uuid, PK)
- `plate` (text, indice unico case-insensitive)
- `name` (text)
- `responsible_name` (text)
- `status` (`Ativo` | `Inativo` | `Em Manut.`)
- `created_at` / `updated_at` (timestamptz)

### 4.3 Seguranca e politicas
- RLS habilitado nas tabelas.
- Politicas atuais permitem acesso publico (interno).
- Trigger atualiza `updated_at` automaticamente.

## 5. Servicos da aplicacao
### `vehicleService`
- `createRecord`, `listRecords`, `getRecord`, `updateRecord`, `deleteRecord`.

### `vehicleCatalogService`
- `listVehicles`, `createVehicle`, `updateVehicle`, `deleteVehicle`.

### `reportService`
- Calculos de estatisticas do dashboard (uso, motivos, ranking, atrasos, tempo medio, timeline).

## 6. Configuracao do ambiente
### 6.1 Pre-requisitos
- Node.js 18+
- NPM
- Projeto Supabase ativo

### 6.2 Variaveis de ambiente
Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

### 6.3 Banco de dados
- Execute `supabase/database.sql` no SQL Editor do Supabase.
- Esse arquivo cria tabelas, indices, trigger e politicas RLS.

### 6.4 Executar localmente
```bash
npm install
npm run dev
```
Aplicacao local: `http://localhost:5173` (porta padrao Vite, pode variar se ocupada).

## 7. Scripts disponiveis
- `npm run dev`: inicia ambiente local.
- `npm run build`: gera build de producao.
- `npm run preview`: sobe build local para validacao.
- `npm run lint`: executa ESLint.
- `npm run typecheck`: valida tipos TypeScript.

## 8. PWA
Arquivos:
- `public/manifest.webmanifest`
- `public/sw.js`
- registro do service worker em `index.html`

Comportamento:
- Instalavel em desktop/mobile.
- Cache de assets estaticos.
- Requisicoes para Supabase sempre tentam rede primeiro.
- Em offline, API nao grava dados no servidor.

## 9. Exportacoes e relatorios
Utilitarios em `src/utils/export.ts`:
- `exportToCSV(records)`
- `exportDailyUtilizationExcel(records, vehicles)` (arquivo CSV com separador `;` para Excel)
- `generatePrintReport(records, filters)`

## 10. Observacoes importantes
- A autenticacao atual e local e simples (nao usa Supabase Auth).
- Existe script de teste `test-supabase.mjs` com URL/chave explicitas; ideal remover segredos hardcoded antes de publicacao.
- O Service Worker tambem possui URL de projeto Supabase fixa em `public/sw.js`.
- Para ambiente de producao, recomenda-se HTTPS, autenticacao robusta e revisao de politicas RLS.

## 11. Troubleshooting rapido
- Erro `Missing Supabase environment variables`:
  - Verifique `.env.local` e reinicie `npm run dev`.
- Falha ao salvar registro:
  - Confirmar execucao do SQL e credenciais Supabase.
- Tabela nao encontrada:
  - Validar se `vehicle_records` e `vehicles` foram criadas no projeto correto.
- PWA nao instala:
  - Verificar manifest, service worker e uso de HTTPS em producao.

## 12. Proximas melhorias sugeridas
1. Trocar login local por Supabase Auth.
2. Remover credenciais/chaves hardcoded de scripts e SW.
3. Criar niveis de permissao por perfil.
4. Adicionar testes automatizados (unitarios/integracao).
5. Adicionar auditoria de alteracoes (quem editou/excluiu).
