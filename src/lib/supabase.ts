import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { assertApiUrl } from './environment.ts';
import { requireDevEnvironment } from './runtime.ts';

let client: SupabaseClient<Database> | undefined;

export function getSupabase(): SupabaseClient<Database> {
  if (import.meta.env?.MODE === 'demo') throw new Error('Modo demonstracao nao cria cliente remoto.');
  const config = requireDevEnvironment();
  // Login/refresh tambem escrevem no Auth. Inventario original nao usa o SDK.
  if (config.access === 'metadata-only') throw new Error('SDK bloqueado: projeto original autorizado somente para inventario no painel.');
  if (!client) {
    client = createClient<Database>(config.supabaseUrl, config.publicKey, {
      auth: { storageKey: 'portaria-dev-' + config.projectRef, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        assertApiUrl(input instanceof Request ? input.url : input.toString(), config);
        return fetch(input, { ...init, redirect: 'error' });
      } },
    });
  }
  return client;
}

// Importar um servico nao cria cliente, sessao ou conexao.
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) {
    const instance = getSupabase();
    const value = Reflect.get(instance, property);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
