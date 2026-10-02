self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    data: {
      url: data.data?.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(data.title || '영어 단어', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.registration.scope).href;
  event.waitUntil(self.clients.openWindow(target));
});
