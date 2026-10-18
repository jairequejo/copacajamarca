// Bump this release whenever publishing changes to the administration application.
const ADMIN_RELEASE = '2026-10-18.2';

// Updates wait until the administrator chooses to install them.
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage(ADMIN_RELEASE);
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Network only: never persists actas, credentials, photos, PDFs or API responses.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});
