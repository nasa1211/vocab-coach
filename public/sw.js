// 백그라운드 푸시 알림 수신 이벤트
self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: {
      url: data.data?.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AI 단어 코치', options)
  );
});

// 알림 클릭 시 해당 URL로 이동
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});