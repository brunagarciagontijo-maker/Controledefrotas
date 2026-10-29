# Materiais de backup próprio — preparação, sem aquisição

**Suspensos por decisão do usuário.** Não instalar/adquirir/restaurar automaticamente. O plano vigente dispensa backup completo e laboratório: [ORIGINAL_SIMPLIFIED_DEPLOY.md](../../../ORIGINAL_SIMPLIFIED_DEPLOY.md). Estes verificadores/modelos são preservados como referência opcional, não requisito atual nem prova de backup existente.

Leia o procedimento vigente em [ORIGINAL_BACKUP_RUNBOOK.md](../../../ORIGINAL_BACKUP_RUNBOOK.md).

A estação escolhida agora é este Windows, com uma cópia local criptografada e laboratório isolado; segunda mídia não é condição obrigatória na decisão atual. Veja diagnóstico, risco, pastas e comandos de instalação em [ORIGINAL_BACKUP_WINDOWS_STATION.md](../../../ORIGINAL_BACKUP_WINDOWS_STATION.md). O preparador `scripts/backup/prepare-windows-station.ps1` apenas imprime o plano por padrão; criação de pastas/ACL exige a opção explícita e autorização. Não criptografa nem adquire backup.

- `07_capabilities_readonly.sql`: consulta futura de capacidades, cobertura, tamanho e extensões. Relatório agregado, sem registros pessoais. Não prova que um dump completo funcione.
- `08_storage_metadata_private_readonly.sql`: captura futura **privada** dos metadados completos dos quatro buckets/objetos. Inclui nomes e caminhos pessoais; saída obrigatoriamente fora do repositório, criptografada e não compartilhada. Não é relatório nem backup dos bytes.
- Os modelos `scripts/backup/*.ps1.example` abortam imediatamente e mantêm todos os comandos remotos dentro de comentário. Não foram executados. Exigem futura adaptação/revisão e autorização específica.
- `scripts/backup/verify-storage-copy.mjs`: verifica apenas arquivos locais já adquiridos. Não faz exportação, não instala ferramentas, não restaura, não consulta Supabase e nunca marca a restauração como comprovada.

## Contrato do manifesto privado de bytes

O coletor remoto/empacotador ainda precisa ser preparado e ensaiado após autorização. O formato abaixo é o contrato para sua saída; **não** é o JSON agregado da auditoria 03 nem a saída bruta de 08. Não inventar um manifesto real a partir de contagens.

```json
{
  "format_version": 1,
  "snapshot_id": "00000000-0000-4000-8000-000000000001",
  "buckets": [
    {"id":"access-documents","expected_objects":1,"configuration":{"id":"access-documents","public":false}},
    {"id":"driver-cnh-documents","expected_objects":0,"configuration":{"id":"driver-cnh-documents","public":true}},
    {"id":"person-documents","expected_objects":0,"configuration":{"id":"person-documents","public":false}},
    {"id":"vehicle-operation-photos","expected_objects":0,"configuration":{"id":"vehicle-operation-photos","public":true}}
  ],
  "objects": [
    {
      "bucket":"access-documents",
      "name":"pasta-ficticia/foto.jpg",
      "file":"objects/00000000-0000-4000-8000-000000000002.bin",
      "bytes":0,
      "sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "metadata":{"id":"00000000-0000-4000-8000-000000000003","bucket_id":"access-documents","name":"pasta-ficticia/foto.jpg","owner_id":null,"metadata":{"size":0}}
    }
  ]
}
```

Exemplo totalmente fictício, inclusive arquivo vazio. No backup real, `configuration` e `metadata` devem guardar os registros completos disponíveis, não apenas os campos ilustrados. Cada `expected_objects` vem de inventário independente da origem na mesma janela; cada tamanho/hash vem dos bytes lidos. Guardar IDs, owners nulos, timestamps, versões, MIME, `user_metadata` e campos adicionais quando disponíveis. Não normalizar nomes, capitalização ou Unicode.

Os nomes locais são UUIDs: nomes S3 podem diferir apenas pelo caso, conter caracteres reservados do Windows ou exigir codificação reversível. O mapa privado conserva bucket/nome original. O verificador exige um arquivo distinto por objeto e recusa caminhos absolutos/travessia e arquivos não manifestados. Rclone não gera este contrato/mapeamento automaticamente: um empacotador complementar, com teste de codificação, é pré-requisito.

Comandos locais para uso futuro, depois da aquisição autorizada:

```powershell
node scripts/backup/verify-storage-copy.mjs --manifest 'X:\PortariaBackup\run\manifest.private.json' --root 'X:\PortariaBackup\run\source'
node scripts/backup/verify-storage-copy.mjs --manifest 'X:\PortariaBackup\run\manifest.private.json' --root 'X:\PortariaBackup\run\source' --restored-manifest 'X:\PortariaBackup\run\restored.private.json' --restored-root 'X:\PortariaBackup\run\restored'
```

`X:` é ilustrativo: deve ser mídia local protegida/criptografada e não sincronizada. Não foi criada. O programa não comprova criptografia, ACL, ausência de mapeamento remoto nem todas as formas de sincronização; essas condições precisam de conferência humana. Ele recusa o próprio repositório, URLs/UNC e diretórios de sincronização reconhecidos, mas não substitui essa conferência.

Saída: somente totais, hashes globais de manifestos e contadores de diferenças. Não imprime nomes de objetos, conteúdo, IDs ou metadados individuais. Exit 0 significa apenas que a verificação local solicitada passou; exit 1 bloqueia entrada/cópia inválida; exit 2 indica diferenças entre cópias, inclusive metadados. Todos os casos mantêm `restoreVerified:false` e `storageBackupVerified:false`.

Nunca usar esse resultado para preencher automaticamente recibos de liberação. A prova de restauração exige banco, arquivos, serviços, vínculos, permissões, isolamento e evidências do administrador conforme o runbook.
