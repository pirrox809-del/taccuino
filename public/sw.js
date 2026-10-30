/*
 * Taccuino — service worker minimale per l'installabilità PWA.
 * Passthrough: nessuna cache dei contenuti (i dati vivono nel database locale
 * del workspace; la strategia offline vera è prevista in una fase successiva).
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Nessuna intercettazione: le richieste passano alla rete.
  void event
})
