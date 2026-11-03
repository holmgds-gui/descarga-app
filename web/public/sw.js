// Descarga — service worker: recebe notificações mesmo com o app fechado.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Descarga', body: event.data ? event.data.text() : '' }
  }
  const icon = new URL('icon-192.png', self.registration.scope).href
  event.waitUntil(
    self.registration.showNotification(data.title || 'Descarga', {
      body: data.body || '',
      tag: data.tag,
      renotify: !!data.tag,
      icon: data.icon || icon,
      badge: icon,
      data: { url: data.url || self.registration.scope },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = (event.notification.data && event.notification.data.url) || self.registration.scope
  const target = new URL(raw, self.registration.scope).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) {
        if (w.url.startsWith(self.registration.scope)) {
          await w.focus()
          if ('navigate' in w) await w.navigate(target)
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
