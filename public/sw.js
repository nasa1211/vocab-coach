self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});

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
  const origin = new URL(self.registration.scope).origin;

  event.waitUntil((async function () {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const current = windows.find(function (client) {
      return new URL(client.url).origin === origin;
    });
    if (current) {
      if (typeof current.navigate === 'function') {
        try {
          const opened = await current.navigate(target);
          if (opened) return opened.focus();
        } catch {
          // A suspended window cannot move until it is focused.
        }
      }
      current.postMessage({ type: 'open-url', url: target });
      try {
        return await current.focus();
      } catch {
        // The home-screen app is not live, so open a window below.
      }
    }
    return self.clients.openWindow(target);
  })());
});
