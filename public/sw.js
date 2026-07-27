self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'schedulent',
      data: data.url || '/'
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const url = event.notification.data || '/'
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

// Local scheduled notifications — triggered by postMessage from the app
self.addEventListener('message', event => {
  if (event.data?.type === 'SCHEDULE_NOTIFICATIONS') {
    const { notifications } = event.data
    for (const n of notifications) {
      const delay = n.fireAt - Date.now()
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          self.registration.showNotification(n.title, {
            body: n.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: n.tag,
            data: '/'
          })
        }, delay)
      }
    }
  }
})
