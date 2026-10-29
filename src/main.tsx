import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EnvironmentSetup } from './components/EnvironmentSetup';
import { validateDevEnvironment } from './lib/environment';
import { initializeDevRuntime } from './lib/runtime';
import { disableDevServiceWorker } from './lib/devServiceWorker';
import './index.css';

const root = createRoot(document.getElementById('root')!);
async function start() {
  if (await disableDevServiceWorker(__DEV_TARGET__.appOrigin)) {
    window.location.reload();
    return;
  }
  if (import.meta.env.MODE === 'demo') {
    initializeDevRuntime({projectRef:'offline',supabaseUrl:'https://offline.invalid',publicKey:'',appUrl:window.location.origin});
    const [{ default: App }, { DemoProvider }] = await Promise.all([import('./App'), import('./demo/DemoProvider')]);
    root.render(<StrictMode><DemoProvider><App /></DemoProvider></StrictMode>);
    return;
  }
  const result = await validateDevEnvironment(import.meta.env, __DEV_TARGET__, import.meta.env.MODE, window.location.origin);
  if (!result.ready) {
    root.render(<EnvironmentSetup issues={result.issues} />);
    return;
  }
  initializeDevRuntime(result.config);
  if (result.config.access === 'metadata-only') {
    root.render(<main className="min-h-screen bg-slate-100 p-6"><section className="mx-auto max-w-2xl rounded-2xl bg-white p-7 shadow"><h1 className="text-2xl font-bold">Supabase original — somente inventário</h1><p className="my-4">Destino conferido. Login, Storage, Realtime e operações de escrita permanecem bloqueados nesta etapa.</p><p>Execute somente supabase/original/00_inventory_readonly.sql no painel e salve o JSON em .secrets/original-inventory.json. Consulte ORIGINAL_ACCESS.md.</p><p className="mt-4">Para testar as melhorias com dados fictícios, use npm run dev:demo.</p></section></main>);
    return;
  }
  const [{ default: App }, { AuthProvider }] = await Promise.all([import('./App'), import('./auth/AuthProvider')]);
  root.render(<StrictMode><AuthProvider><App /></AuthProvider></StrictMode>);
}
void start().catch(() => {
  root.render(<EnvironmentSetup issues={['Nao foi possivel validar e iniciar o ambiente DEV. Confira a configuracao local.']} />);
});
