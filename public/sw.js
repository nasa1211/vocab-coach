self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

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

function isIos() {
  return /iPhone|iPad|iPod/i.test(self.navigator.userAgent || '');
}

function findClient(windows, origin) {
  return windows.find(function (client) {
    try {
      return new URL(client.url).origin === origin;
    } catch {
      return false;
    }
  });
}

async function focusApp(current, target) {
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
    return undefined;
  }
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.registration.scope).href;
  const origin = new URL(self.registration.scope).origin;
  const ios = isIos();

  event.waitUntil((async function () {
    const attempts = ios ? 8 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const current = findClient(windows, origin);
      if (current) return focusApp(current, target);
      if (!ios || attempt === attempts - 1) break;
      await new Promise(function (resolve) { setTimeout(resolve, 150); });
    }
    if (ios) return undefined;
    return self.clients.openWindow(target);
  })());
});
