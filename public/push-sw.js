/* 늘봄 휴대폰 알림 (서버 → Firebase 클라우드 메시징 → 이 서비스 워커)
 * vite-plugin-pwa 가 만드는 sw.js 에 importScripts 로 들어갑니다. (vite.config.ts)
 * 앱이 닫혀 있거나 화면이 꺼져 있어도 알림을 띄웁니다.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    const json = event.data ? event.data.json() : {}
    data = json.data || json
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    (async () => {
      // 늘봄 화면을 보고 있는 중이면 화면이 직접 알려 주므로 중복으로 띄우지 않습니다.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows.some((w) => w.visibilityState === 'visible')) return

      await self.registration.showNotification(data.title || '늘봄', {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: data.tag || undefined,
        requireInteraction: true, // 직접 닫을 때까지 남김
        data: { url: data.url || '/' },
      })
    })(),
  )
})

// 알림을 누르면 늘봄을 열고 해당 화면(보호자 화면 등)으로 이동합니다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) {
        if ('focus' in w) {
          try {
            await w.navigate(url)
          } catch {
            /* 다른 주소면 이동하지 못할 수 있음 */
          }
          return w.focus()
        }
      }
      return self.clients.openWindow(url)
    })(),
  )
})
