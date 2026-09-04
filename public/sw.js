const CACHE_VERSION = 'shiv-shakti-crm-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  )
})

// Intentionally no fetch cache: this installable admin app always loads the
// latest deployed CRM and cannot trap an administrator on stale business data.
