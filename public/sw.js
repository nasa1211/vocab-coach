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

const PUSH_INTENT_CACHE = 'push-intent-v1';

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function pushFieldsFromUrl(target) {
  const url = new URL(target);
  return {
    date: url.searchParams.get('date'),
    word: url.searchParams.get('word'),
    slot: url.searchParams.get('slot'),
  };
}

function intentRequestUrl() {
  return new URL('/__push_intent__', self.registration.scope).href;
}

async function savePushIntent(fields) {
  if (!fields.date && !fields.word) return;
  const cache = await caches.open(PUSH_INTENT_CACHE);
  await cache.put(
    intentRequestUrl(),
    new Response(
      JSON.stringify({
        date: fields.date,
        word: fields.word,
        slot: fields.slot,
        at: Date.now(),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    ),
  );
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

async function focusHomeScreen(current, fields) {
  try {
    await current.focus();
  } catch {
    // The home screen app can still receive the slot after it is visible.
  }
  if (!fields.date && !fields.word) return;
  try {
    current.postMessage({
      type: 'open-push',
      date: fields.date,
      word: fields.word,
      slot: fields.slot,
    });
  } catch {
    // A window iOS just created cannot take a message until it finishes loading.
  }
}

async function findHomeScreen(origin) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return findClient(windows, origin);
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.registration.scope).href;
  const origin = new URL(self.registration.scope).origin;
  const ios = isIos();
  if (ios) event.preventDefault();

  event.waitUntil((async function () {
    if (!ios) {
      const current = await findHomeScreen(origin);
      if (current) return focusApp(current, target);
      return self.clients.openWindow(target);
    }

    const fields = pushFieldsFromUrl(target);
    await savePushIntent(fields);
    const home = new URL('/', self.registration.scope).href;
    let current = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      current = await findHomeScreen(origin);
      if (current) break;
      await delay(150);
    }
    if (!current) current = await self.clients.openWindow(home);
    if (!current) return undefined;
    await focusHomeScreen(current, fields);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await delay(200);
      await focusHomeScreen(current, fields);
    }
    return undefined;
  })());
});
