import { BLOCKED_PROJECT_HASHES } from '../config/blockedProjects.ts';
import { approvedOriginalRelease, type OriginalRelease } from '../config/originalRelease.ts';
export interface DevTarget {
  environment: string;
  projectRef: string;
  publicKeySha256: string;
  appOrigin: string;
  remoteEnabled: boolean;
  access?: 'metadata-only' | 'read-write';
  authorization?: 'ORIGINAL SOMENTE LEITURA' | 'ORIGINAL COM ESCRITA APROVADA';
  release?: OriginalRelease;
}

export interface DevEnvironment {
  projectRef: string;
  supabaseUrl: string;
  publicKey: string;
  appUrl: string;
  mode?: 'devcloud' | 'original';
  access?: 'read-write' | 'metadata-only';
  release?: DevTarget['release'];
}

export type EnvironmentResult =
  | { ready: true; config: DevEnvironment; issues: [] }
  | { ready: false; issues: string[] };

export type EnvironmentInput = Record<string, string | undefined>;
export type Digest = (text: string) => Promise<string>;

export const UNCONFIGURED_TARGET: DevTarget = {
  environment: 'devcloud', projectRef: '', publicKeySha256: '',
  appOrigin: 'http://127.0.0.1:5173', remoteEnabled: false,
};

export function hasApprovedOriginalRelease(value:unknown):boolean {
  return approvedOriginalRelease(value);
}

export function parseDevTarget(value: unknown): DevTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Arquivo de identificacao DEV invalido.');
  const item = value as Record<string, unknown>;
  const fields = ['environment','projectRef','publicKeySha256','appOrigin','remoteEnabled'];
  const allowed = item.environment === 'original' ? [...fields,'access','authorization','release'] : fields;
  if (Object.keys(item).some(key => !allowed.includes(key)) ||
    fields.slice(0,4).some(key => typeof item[key] !== 'string') || typeof item.remoteEnabled !== 'boolean') {
    throw new Error('Arquivo DEV deve conter somente os campos documentados.');
  }
  const approvedWrite=item.access==='read-write'&&item.authorization==='ORIGINAL COM ESCRITA APROVADA'&&hasApprovedOriginalRelease(item.release);
  if (item.environment === 'original' && !approvedWrite && (item.access !== 'metadata-only' || item.authorization !== 'ORIGINAL SOMENTE LEITURA' || item.release!==undefined)) throw new Error('O projeto original exige autorizacao explicita e comprovacao da revisao.');
  return { environment: item.environment as string, projectRef: item.projectRef as string,
    publicKeySha256: item.publicKeySha256 as string, appOrigin: item.appOrigin as string, remoteEnabled: item.remoteEnabled,
    ...(item.environment === 'original' ? {access:item.access as DevTarget['access'],authorization:item.authorization as DevTarget['authorization'],...(approvedWrite?{release:item.release as DevTarget['release']}:{})} : {}) };
}

export async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parsePublicKey(key: string, projectRef: string): boolean {
  if (/^sb_publishable_[a-zA-Z0-9_-]{20,}$/.test(key)) return true;
  if (!/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(key)) return false;
  try {
    const encoded = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return payload.role === 'anon' && payload.ref === projectRef &&
      typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch { return false; }
}

export async function validateDevEnvironment(
  input: EnvironmentInput,
  target: DevTarget,
  mode: string,
  currentOrigin?: string,
  digest: Digest = sha256,
): Promise<EnvironmentResult> {
  const issues: string[] = [];
  const original = mode === 'original' && target.environment === 'original';
  if (!original && (mode !== 'devcloud' || target.environment !== 'devcloud')) issues.push('Perfil de ambiente nao autorizado.');
  const approvedWrite=original&&target.access==='read-write'&&target.authorization==='ORIGINAL COM ESCRITA APROVADA'&&hasApprovedOriginalRelease(target.release);
  if (original && !approvedWrite && (target.access !== 'metadata-only' || target.authorization !== 'ORIGINAL SOMENTE LEITURA' || target.release!==undefined)) issues.push('O original exige SQL aprovado e comprovacao de backup ou dispensa de recuperacao expressamente registrada.');
  if (target.remoteEnabled !== true) issues.push('O projeto DEV ainda nao foi autorizado na configuracao local.');
  if (!/^[a-z0-9]{20}$/.test(target.projectRef)) issues.push('Identificacao do projeto DEV ausente ou invalida.');
  if (!/^[a-f0-9]{64}$/.test(target.publicKeySha256)) issues.push('Impressao digital da chave publica DEV ausente ou invalida.');
  if (!original && target.projectRef && BLOCKED_PROJECT_HASHES.includes(await digest(target.projectRef))) issues.push('Destino original bloqueado no perfil DEV. Use o perfil original explicitamente autorizado.');
  const rawUrl = input.VITE_SUPABASE_URL?.trim() || '';
  const publicKey = input.VITE_SUPABASE_ANON_KEY?.trim() || '';
  const rawApp = input.VITE_PUBLIC_APP_URL?.trim() || '';
  let supabaseUrl = '';
  let appUrl = '';
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.hostname !== `${target.projectRef}.supabase.co` ||
      url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    supabaseUrl = url.origin;
  } catch { issues.push('VITE_SUPABASE_URL deve corresponder exatamente ao projeto DEV autorizado.'); }
  try {
    const app = new URL(rawApp);
    const loopback=app.protocol==='http:'&&['127.0.0.1','localhost'].includes(app.hostname)&&Boolean(app.port);
    const published=approvedWrite&&app.protocol==='https:'&&!app.port&&!['localhost','127.0.0.1'].includes(app.hostname);
    if ((!loopback&&!published) || app.username || app.password || app.search || app.hash || app.pathname !== '/' ||
      app.origin !== target.appOrigin || (currentOrigin !== undefined && app.origin !== currentOrigin)) throw new Error();
    appUrl = app.origin;
  } catch { issues.push('VITE_PUBLIC_APP_URL deve corresponder a origem fixada: local com porta, ou HTTPS somente apos liberacao original aprovada.'); }
  if (!parsePublicKey(publicKey, target.projectRef)) {
    issues.push('Use somente uma chave publica DEV valida; chaves administrativas sao recusadas.');
  } else if (await digest(publicKey) !== target.publicKeySha256) {
    issues.push('A chave publica nao corresponde a configuracao DEV aprovada.');
  }
  return issues.length ? { ready: false, issues } : {
    ready: true, config: Object.freeze({ projectRef: target.projectRef, supabaseUrl, publicKey, appUrl,
      mode: original ? 'original' as const : 'devcloud' as const, access: original&&!approvedWrite ? 'metadata-only' as const : 'read-write' as const,
      ...(approvedWrite?{release:Object.freeze({...target.release!})}:{}) }), issues: [],
  };
}

export function assertApiUrl(value: string | URL, config: DevEnvironment): URL {
  const url = new URL(value);
  if (url.origin !== config.supabaseUrl || url.username || url.password ||
    !/^\/(auth|rest|storage|realtime)\/v1(?:\/|$)/.test(url.pathname)) {
    throw new Error('Destino de rede fora do Supabase DEV autorizado.');
  }
  return url;
}

export function assertPrivateFileUrl(value: string, config: DevEnvironment): string {
  const url = assertApiUrl(value, config);
  if (!/^\/storage\/v1\/object\/sign\/(person-documents|access-documents|vehicle-operation-photos|portaria-evidence|driver-cnh-documents|portaria-parcels)\//.test(url.pathname) || !url.searchParams.get('token')) {
    throw new Error('Documento fora do Storage privado DEV.');
  }
  return url.toString();
}

export function extractDevLookup(raw: string, keys: string[], appOrigin: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//') && !value.startsWith('/')) return value;
  const url = new URL(value, appOrigin);
  if (url.origin !== appOrigin || url.username || url.password || url.pathname !== '/') {
    throw new Error('Este QR Code nao pertence ao ambiente DEV.');
  }
  for (const key of keys) { const result = url.searchParams.get(key); if (result) return result; }
  throw new Error('QR Code DEV sem identificacao reconhecida.');
}
