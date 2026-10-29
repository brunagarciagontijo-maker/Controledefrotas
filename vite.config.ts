import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { UNCONFIGURED_TARGET, parseDevTarget, validateDevEnvironment, type DevTarget } from './src/lib/environment.ts';
import { createNetlifyProductionTarget, loadNetlifyProductionContract } from './scripts/netlify-production.ts';

export default defineConfig(async ({ mode,command }) => {
  if (!['devcloud','original','demo'].includes(mode)) throw new Error('Perfil nao autorizado neste checkout.');
  const netlify = Boolean(process.env.NETLIFY);
  if (netlify && (command !== 'build' || mode !== 'original' || process.env.PORTARIA_OFFLINE)) throw new Error('Netlify exige build original no contexto de producao aprovado.');
  const offline = process.env.PORTARIA_OFFLINE === '1' || mode === 'demo';
  // CI reads only the three explicit build variables, never local private files.
  const input = offline ? {} : netlify ? {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_PUBLIC_APP_URL: process.env.VITE_PUBLIC_APP_URL,
  } : loadEnv(mode, process.cwd(), 'VITE_');
  let target: DevTarget = UNCONFIGURED_TARGET;
  if(offline&&process.env.PORTARIA_TEST_PORT==='5273')target={...UNCONFIGURED_TARGET,appOrigin:'http://127.0.0.1:5273'};
  const targetFile = mode === 'original' ? 'original.target.local.json' : 'devcloud.target.local.json';
  if (netlify) {
    target = await createNetlifyProductionTarget(process.env, input, loadNetlifyProductionContract());
  } else if (!offline && existsSync(targetFile)) {
    try { target = parseDevTarget(JSON.parse(readFileSync(targetFile, 'utf8'))); }
    catch { throw new Error('Arquivo de destino invalido. Nenhum valor sera exibido.'); }
  }
  const result = await validateDevEnvironment(input, target, mode === 'demo' ? 'devcloud' : mode, undefined,
    async (value) => createHash('sha256').update(value).digest('hex'));
  const hasConfiguration = Boolean(input.VITE_SUPABASE_URL || input.VITE_SUPABASE_ANON_KEY || target.projectRef || target.publicKeySha256 || target.remoteEnabled);
  if (hasConfiguration && !result.ready) throw new Error(result.issues.join('\n'));
  if(mode==='original'&&command==='build'&&(!result.ready||result.config.access!=='read-write'))throw new Error('Build original bloqueado: faltam revisao, recuperacao/dispensa registrada, SQL e liberacao especifica do frontend.');
  const app = new URL(result.ready ? result.config.appUrl : target.appOrigin);
  if(mode==='demo'&&process.env.PORTARIA_DEMO_PORT){if(!['5173','5174','5274'].includes(process.env.PORTARIA_DEMO_PORT))throw new Error('Porta demo nao autorizada.');app.port=process.env.PORTARIA_DEMO_PORT;}
  const serverHost=app.protocol==='http:'?app.hostname:'127.0.0.1';
  const serverPort=app.protocol==='http:'?Number(app.port):5173;
  const apiOrigin = result.ready ? result.config.supabaseUrl : '';
  const websocket = apiOrigin.replace('https:', 'wss:');
  const policy = [
    "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' ws://" + serverHost+':'+serverPort + ' ' + apiOrigin + ' ' + websocket,
    "img-src 'self' data: blob: " + apiOrigin, "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  ].join('; ');
  const productionHeaders: Plugin = {
    name: 'portaria-production-headers',
    generateBundle() {
      // Preserve the existing QR print windows without allowing arbitrary inline scripts.
      const printScriptHash = createHash('sha256').update('window.onload = () => { window.print(); window.close(); };').digest('base64');
      const productionPolicy = ["default-src 'self'", "script-src 'self' 'sha256-" + printScriptHash + "'", "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' " + apiOrigin + ' ' + websocket, "img-src 'self' data: blob: " + apiOrigin,
        "media-src 'self' blob:", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; ');
      this.emitFile({ type: 'asset', fileName: '_headers', source: '/*\n  Content-Security-Policy: ' + productionPolicy +
        '\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(self), microphone=(), geolocation=()\n/index.html\n  Cache-Control: no-cache\n/sw.js\n  Cache-Control: no-cache\n' });
    },
  };
  return {
    // Vite must not load .env files a second time in a CI checkout.
    ...(netlify ? { envDir: false as const } : {}),
    plugins: [react(), ...(netlify ? [productionHeaders] : [])], define: {
      __DEV_TARGET__: JSON.stringify(target),
      ...(offline ? {
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(''),
        'import.meta.env.VITE_PUBLIC_APP_URL': JSON.stringify(''),
      } : {}),
    },
    server: { host: serverHost, port: serverPort, strictPort: true, headers: { 'Content-Security-Policy': policy } },
    preview: { host: serverHost, port: serverPort, strictPort: true, headers: { 'Content-Security-Policy': policy } },
    build: { sourcemap: false, emptyOutDir: true },
  };
});
