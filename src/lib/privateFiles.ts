import { supabase } from './supabase';
import { assertPrivateFileUrl } from './environment';
import { requireDevEnvironment } from './runtime';

export const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function validateUpload(file: File, kind: 'document' | 'photo'): void {
  const allowed = kind === 'document' ? DOCUMENT_TYPES : PHOTO_TYPES;
  if (!allowed.includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Use um arquivo permitido de ate 10 MB (PDF ou imagem para documentos; imagem para fotos).');
  }
}

export async function signedFileUrl(bucket: string, filePath: string): Promise<string> {
  if (!filePath || filePath.startsWith('/') || filePath.includes('..') || filePath.includes('://')) {
    throw new Error('Caminho de arquivo DEV invalido.');
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 600);
  if (error || !data?.signedUrl) throw new Error('Arquivo privado indisponivel. Confira suas permissoes.');
  return assertPrivateFileUrl(data.signedUrl, requireDevEnvironment());
}
