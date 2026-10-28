export function safeSignatureSource(value: string | null | undefined): string {
  if (!value || value.length > 2 * 1024 * 1024) return '';
  return /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(value) ? value : '';
}
