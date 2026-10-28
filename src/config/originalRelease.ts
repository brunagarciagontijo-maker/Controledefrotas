// Um frontend novo nunca aceita um contrato de banco anterior nem um pacote parcial.
export const ORIGINAL_SCHEMA_VERSION = 5 as const;
export const ORIGINAL_MIGRATIONS = ['001_foundation.sql', '002_authorization.sql', '003_operations.sql', '004_private_files.sql', '005_daily_yard_parcels.sql', '006_physical_checks_timeline.sql', '007_oil_checks.sql'] as const;

export const NO_BACKUP_ACKNOWLEDGEMENT = 'DISPENSO BACKUP E RESTAURACAO; ACEITO PERDA DOS REGISTROS; NAO AUTORIZO EXCLUSAO OU SQL REMOTO';
export type RecoveryStrategy = 'verified-backup' | 'no-backup-risk-accepted';
export type OriginalRelease = {
  inventorySha256: string;
  sqlBundleSha256: string;
  schemaVersion: typeof ORIGINAL_SCHEMA_VERSION;
} & ({ backupReceiptSha256: string; recoveryStrategy?: never; recoveryWaiverSha256?: never }
  | { recoveryStrategy: 'no-backup-risk-accepted'; recoveryWaiverSha256: string; backupReceiptSha256?: never });

export function approvedOriginalRelease(value: unknown): value is OriginalRelease {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const waived = item.recoveryStrategy === 'no-backup-risk-accepted';
  const keys = ['inventorySha256', 'sqlBundleSha256', 'schemaVersion',
    ...(waived ? ['recoveryStrategy', 'recoveryWaiverSha256'] : ['backupReceiptSha256'])];
  return Object.keys(item).length === keys.length && Object.keys(item).every(key => keys.includes(key)) &&
    item.schemaVersion === ORIGINAL_SCHEMA_VERSION &&
    ['inventorySha256', 'sqlBundleSha256', waived ? 'recoveryWaiverSha256' : 'backupReceiptSha256']
      .every(key => typeof item[key] === 'string' && /^[a-f0-9]{64}$/.test(item[key] as string));
}

export function originalReleaseMatches(marker: Record<string, unknown>, release: unknown): boolean {
  if (!approvedOriginalRelease(release) || marker.schema_version !== release.schemaVersion) return false;
  if (release.recoveryStrategy === 'no-backup-risk-accepted') {
    return marker.recovery_strategy === 'no-backup-risk-accepted' &&
      marker.recovery_evidence_sha256 === release.recoveryWaiverSha256 && marker.backup_sha256 === null;
  }
  return marker.recovery_strategy === 'verified-backup' &&
    marker.recovery_evidence_sha256 === release.backupReceiptSha256 && marker.backup_sha256 === release.backupReceiptSha256;
}
