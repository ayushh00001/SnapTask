self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const data = event.data.json()
    const title = data.title || 'SnapTask'
    const options = {
      body: data.message || '',
      icon: '/icon.png',
      badge: '/badge.png',
      data: { url: data.link || '/' },
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    // ignore malformed push
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
