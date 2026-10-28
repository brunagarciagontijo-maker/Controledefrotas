import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BLOCKED_PROJECT_HASHES } from '../src/config/blockedProjects.ts';
import { approvedOriginalRelease, type OriginalRelease } from '../src/config/originalRelease.ts';
import { parseDevTarget, validateDevEnvironment, type DevTarget, type Digest, type EnvironmentInput } from '../src/lib/environment.ts';
import { currentOriginalSources } from './original-sources.ts';

export interface NetlifyProductionContract {
  version: 1;
  branch: 'main';
  origin: string;
  siteName: string;
  repository: string;
  projectRefSha256: string;
  publicKeySha256: string;
  release: OriginalRelease;
  templateFiles: Record<string, string>;
}

const fail = (): never => { throw new Error('Build Netlify bloqueado: contexto, destino ou contrato de producao nao conferem. Nenhum valor privado sera exibido.'); };
const digest: Digest = async value => createHash('sha256').update(value).digest('hex');

export function loadNetlifyProductionContract(): NetlifyProductionContract {
  try { return JSON.parse(readFileSync(new URL('../netlify/production-contract.json', import.meta.url), 'utf8')) as NetlifyProductionContract; }
  catch { return fail(); }
}

function repositoryName(value: string | undefined): string | null {
  if (!value) return null;
  const ssh = value.match(/^git@github\.com:([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
  if (ssh) return ssh[1].toLowerCase();
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.search || url.hash || url.port) return null;
    const name = url.pathname.replace(/^\//, '').replace(/\.git$/, '');
    return /^[\w.-]+\/[\w.-]+$/.test(name) ? name.toLowerCase() : null;
  } catch { return null; }
}

export function isNetlifyProductionContext(env: EnvironmentInput, contract: NetlifyProductionContract): boolean {
  return env.NETLIFY === 'true' && env.CONTEXT === 'production' && env.BRANCH === 'main' &&
    env.PULL_REQUEST === 'false' && env.NETLIFY_PREVIEW_SERVER !== 'true' &&
    env.SITE_NAME === contract.siteName && env.URL?.replace(/\/$/, '') === contract.origin &&
    repositoryName(env.REPOSITORY_URL) === contract.repository.toLowerCase();
}

export async function createNetlifyProductionTarget(
  env: EnvironmentInput, input: EnvironmentInput, contract: NetlifyProductionContract, hash: Digest = digest,
): Promise<DevTarget> {
  const fields = ['version', 'branch', 'origin', 'siteName', 'repository', 'projectRefSha256', 'publicKeySha256', 'release', 'templateFiles'];
  if (!contract || typeof contract !== 'object' || Object.keys(contract).length !== fields.length ||
    Object.keys(contract).some(key => !fields.includes(key)) || contract.version !== 1 || contract.branch !== 'main' ||
    contract.origin !== 'https://controledefrotasgontijo.netlify.app' || contract.siteName !== 'controledefrotasgontijo' ||
    contract.repository !== 'brunagarciagontijo-maker/Controledefrotas' || !isNetlifyProductionContext(env, contract) ||
    !/^[a-f0-9]{64}$/.test(contract.publicKeySha256) || !BLOCKED_PROJECT_HASHES.includes(contract.projectRefSha256) ||
    !approvedOriginalRelease(contract.release) || !currentOriginalSources(contract.templateFiles)) return fail();
  const allowedClientVariables = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_PUBLIC_APP_URL'];
  if (Object.keys(env).some(key => key.startsWith('VITE_') && !allowedClientVariables.includes(key))) return fail();
  let projectRef: string;
  try {
    const url = new URL(input.VITE_SUPABASE_URL || '');
    const match = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
    if (!match) return fail();
    projectRef = match[1];
  } catch { return fail(); }
  if (await hash(projectRef) !== contract.projectRefSha256 || input.VITE_PUBLIC_APP_URL !== contract.origin) return fail();
  const key = input.VITE_SUPABASE_ANON_KEY?.trim() || '';
  if (key.startsWith('eyJ')) {
    const parts = key.split('.');
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]{43}$/.test(parts[2]) || key.includes('sb_publishable_')) return fail();
  }
  const target = parseDevTarget({ environment: 'original', projectRef, publicKeySha256: contract.publicKeySha256,
    appOrigin: contract.origin, remoteEnabled: true, access: 'read-write', authorization: 'ORIGINAL COM ESCRITA APROVADA', release: contract.release });
  const result = await validateDevEnvironment(input, target, 'original', contract.origin, hash);
  if (!result.ready || result.config.access !== 'read-write') return fail();
  return target;
}
