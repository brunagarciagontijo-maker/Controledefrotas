# Pacote SQL DEV, versão 1

Aplicação manual e exclusiva em projeto Supabase independente e vazio. Siga [DEV_SETUP.md](../../DEV_SETUP.md). O arquivo `history-manifest.json` registra os hashes normalizados em LF das 21 migrations originais, preservadas.

| Origem histórica | Incorporação neste pacote |
|---|---|
| `20260304132509`, `20260305111000` | Registros e frota, com índices/trigger de registros do SQL avulso |
| `20260601120000`, `20260601153000` | Operações, fotos e estrutura legada de motoristas |
| `20260601160000` | Seed nominativo excluído; substituído por fixtures artificiais |
| `20260601172000`, `20260609143000` | Códigos e sequências; geração interna no esquema privado |
| `20260601174000`, `20260601175000` | Pátio e CNH opcional, incluindo a validade antes inconsistente |
| `20260601182000`, `20260601183000`, `20260601184000` | Checklist com seis itens finais; sem apagar histórico real |
| `20260605130000`, `20260608100000`, `20260609170000` | Tipos de uso e motorista fixo |
| `20260609120000` | Metadados de CNH adaptados ao Storage privado atual |
| `20260702100000` | Pessoas, veículos pessoais, portaria e relacionamentos |
| `20260702103000`, `20260702104000` | Valores nominativos e placas excluídos |
| `20260720130000` | Papel de motorista explícito nas fixtures, sem classificar todos os funcionários |
| `20260908120000` | Inspeções, autoria verificada e preparação Realtime separada |

Diferenças deliberadas: perfis em `private`, RLS restritiva, ausência de URLs públicas persistidas, autoria no servidor, validade de CNH nullable e manutenção transacional da disponibilidade/checklist. O schema gerenciado de Auth/Storage não é recriado pelo pacote.

O SQL é validado em PostgreSQL WASM com contratos mínimos de Auth/Storage. Serviços HTTP, assinatura de arquivos e entrega de eventos gerenciados exigem validação no projeto DEV. Nenhuma equivalência com o banco de produção foi presumida.
