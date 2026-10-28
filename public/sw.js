// Service Worker para Sistema de Controle de Frotas
const CACHE_NAME = 'frotas-v1';

// Arquivos para fazer cache na instalação
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

// Install event - faz cache dos arquivos estáticos
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando arquivos estáticos');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('[Service Worker] Erro ao fazer cache de alguns arquivos:', error);
        // Continua mesmo se alguns arquivos não forem encontrados
      });
    })
  );
  self.skipWaiting();
});

// Activate event - limpa caches antigas
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('frotas-v') && cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deletando cache antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - estratégia Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Se for requisição para Supabase API, sempre use network
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Não fazer cache de requisições de API
          return response;
        })
        .catch(() => {
          // Se offline, retornar erro apropriado
          return new Response(
            JSON.stringify({ error: 'Offline - não foi possível acessar o servidor' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Para os demais recursos, usa Network First com fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Faz cache de requisições bem-sucedidas
        if (response.ok) {
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => {
        // Se falhar, tenta usar o cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se não estiver no cache, retorna página offline
          if (request.destination === 'document') {
            return new Response(
              '<!DOCTYPE html><html><body>Você está offline. Por favor, reconecte para usar a aplicação.</body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new Response('Recurso não disponível offline', { status: 404 });
        });
      })
  );
});

// Mensagens da aplicação
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
