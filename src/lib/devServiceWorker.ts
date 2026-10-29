export function isOwnedDevWorker(scriptUrl: string, scope: string, appOrigin: string): boolean {
  try {
    const app = new URL(appOrigin);
    if (app.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(app.hostname)) return false;
    return scope === app.origin + '/' && scriptUrl === app.origin + '/sw.js';
  } catch { return false; }
}

export async function disableDevServiceWorker(appOrigin: string): Promise<boolean> {
  if (window.location.origin !== appOrigin || !('serviceWorker' in navigator)) return false;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const worker = registration.active || registration.waiting || registration.installing;
    if (worker && isOwnedDevWorker(worker.scriptURL, registration.scope, appOrigin)) {
      if (await registration.unregister()) {
        // Nome exato do cache deste aplicativo; nao apaga caches de outros sistemas.
        if ('caches' in window) await caches.delete('frotas-v1');
      }
    }
  }
  return navigator.serviceWorker.controller?.scriptURL === appOrigin + '/sw.js';
}
