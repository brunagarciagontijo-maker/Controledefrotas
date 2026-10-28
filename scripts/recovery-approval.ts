import { createHash } from 'node:crypto';
import { NO_BACKUP_ACKNOWLEDGEMENT, type RecoveryStrategy } from '../src/config/originalRelease.ts';
import { currentOriginalSources } from './original-sources.ts';

export interface RecoveryContext { projectRef: string; inventorySha256: string }
export interface RecoveryApproval { strategy: RecoveryStrategy; evidenceSha256: string }

// Somente validacao local. Dispensa nao comprova backup, aplicacao SQL ou operacao remota.
export function recoveryApproval(receipt: Record<string, unknown>, context: RecoveryContext, waiverRaw?: string): RecoveryApproval | null {
  if (!/^[a-z0-9]{20}$/.test(context.projectRef) || !/^[a-f0-9]{64}$/.test(context.inventorySha256)) return null;
  if (receipt.projectRef !== context.projectRef || receipt.inventorySha256 !== context.inventorySha256) return null;
  if (receipt.recoveryStrategy === undefined || receipt.recoveryStrategy === 'verified-backup') {
    return receipt.restoreVerified === true && receipt.storageBackupVerified === true &&
      typeof receipt.backupReceiptSha256 === 'string' && /^[a-f0-9]{64}$/.test(receipt.backupReceiptSha256) &&
      !receipt.recoveryWaiverSha256 ? { strategy: 'verified-backup', evidenceSha256: receipt.backupReceiptSha256 } : null;
  }
  if (receipt.recoveryStrategy !== 'no-backup-risk-accepted' || receipt.restoreVerified !== false ||
      receipt.storageBackupVerified !== false || receipt.backupReceiptSha256 || typeof waiverRaw !== 'string') return null;
  const hash = createHash('sha256').update(waiverRaw).digest('hex');
  if (receipt.recoveryWaiverSha256 !== hash) return null;
  try {
    const value: unknown = JSON.parse(waiverRaw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const waiver = value as Record<string, unknown>;
    const keys = ['version', 'scope', 'projectRef', 'inventorySha256', 'templateFiles', 'accepted', 'acceptedAt', 'acknowledgement'];
    if (Object.keys(waiver).length !== keys.length || Object.keys(waiver).some(key => !keys.includes(key)) ||
        waiver.version !== 1 || waiver.scope !== 'original-001-007' || waiver.accepted !== true ||
        waiver.projectRef !== context.projectRef || waiver.inventorySha256 !== context.inventorySha256 ||
        waiver.acknowledgement !== NO_BACKUP_ACKNOWLEDGEMENT || !currentOriginalSources(waiver.templateFiles) ||
        typeof waiver.acceptedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(waiver.acceptedAt) ||
        !Number.isFinite(Date.parse(waiver.acceptedAt)) || new Date(waiver.acceptedAt).toISOString() !== waiver.acceptedAt ||
        Date.parse(waiver.acceptedAt) > Date.now()) return null;
    return { strategy: 'no-backup-risk-accepted', evidenceSha256: hash };
  } catch { return null; } // Nao reproduzir fragmentos privados de JSON no terminal.
}
