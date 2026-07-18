const CACHE = "worldofmag-v3";
const SHELL = ["/", "/shopping", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];

// Install: cache the app shell
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Notification click: focus an open tab (or open the tasks page).
// Wymagane dla powiadomień wyświetlanych przez `registration.showNotification`
// (m.in. na iOS PWA, gdzie konstruktor `new Notification()` nie działa).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/tasks");
    })
  );
});

// Fetch strategy (009-shopping-offline-sync):
//  - server actions / API / RSC data → never intercept (network only)
//  - /_next/static/* (hashowane, immutable) → cache-first  ⇐ konieczne, by aplikacja WSTAŁA offline
//  - ikony / manifest → cache-first
//  - pozostałe strony (GET) → network-first z fallbackiem na cache (świeże dane, offline = ostatnia kopia)
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Nigdy nie przechwytuj mutacji, API ani żądań RSC (nagłówek RSC ustawiany przez Next przy nawigacji).
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    request.headers.get("RSC") === "1"
  ) {
    return;
  }

  // Immutable, content-hashed static assets — cache-first (bez nich offline nie załaduje JS/CSS).
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
            return res;
          })
      )
    );
    return;
  }

  // Inne zasoby /_next/ (np. /_next/image, dane) — sieć, bez cache.
  if (url.pathname.startsWith("/_next/")) {
    return;
  }

  // Cache-first for icons and static files
  if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/manifest")) {
    e.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Network-first for pages (always fresh data; offline → last cached copy)
  e.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
