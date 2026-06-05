// ══ PIDAC Service Worker v6 ══════════════════════════════════
const CACHE_NAME = 'pidac-v6';
const CACHE_STATIC = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── Instalar: cachear archivos estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(CACHE_STATIC))
      .then(() => self.skipWaiting())
  );
});

// ── Activar: borrar cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: red primero, caché como respaldo (offline)
self.addEventListener('fetch', e => {
  // No interceptar Firebase ni CDN externos (face-api, fonts)
  const url = e.request.url;
  if(url.includes('firestore.googleapis.com') ||
     url.includes('firebase') ||
     url.includes('fonts.googleapis.com') ||
     url.includes('cdn.jsdelivr.net') ||
     url.includes('gstatic.com')){
    return; // dejar que el navegador lo maneje directo
  }

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        // Guardar copia en caché si es una petición GET al mismo origen
        if(e.request.method === 'GET' && url.startsWith(self.location.origin)){
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Push notifications
self.addEventListener('push', e => {
  let data = { title: 'PIDAC', body: 'Nueva notificación' };
  try{ data = e.data.json(); } catch(_){ data.body = e.data?.text() || data.body; }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-512.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'pidac-notif',
      renotify: true,
      data: { url: data.url || self.registration.scope }
    })
  );
});

// Clic en notificación → abrir/enfocar la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true })
      .then(list => {
        if(list.length) return list[0].focus();
        return clients.openWindow(e.notification.data?.url || './');
      })
  );
});
