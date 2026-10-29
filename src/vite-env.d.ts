/// <reference types="vite/client" />

declare const __DEV_TARGET__: import('./lib/environment').DevTarget;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
}
