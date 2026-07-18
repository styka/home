const CACHE = "worldofmag-v5";
// Tylko istniejące trasy (wcześniej były tu martwe /icons/*.png → cache.addAll odrzucał się
// atomowo i CAŁA instalacja SW padała, więc offline nie działało wcale). Ikony cache'ują się
// leniwie przy pierwszym pobraniu.
const SHELL = ["/", "/shopping"];

// Install: precache app shell — ODPORNIE (per-URL, z pominięciem błędów), żeby jeden
// niedostępny zasób nigdy nie wywrócił instalacji SW.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
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
//  - strony (GET) → network-first z fallbackiem na cache; dla NAWIGACJI dodatkowy fallback na
//    shell (/shopping → /), żeby offline aplikacja zawsze wstała, a nie pokazała błędu przeglądarki
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

  // Ikony (generowane trasy) i manifest — cache-first (rzadko się zmieniają).
  if (
    url.pathname.startsWith("/pwa-icon/") ||
    url.pathname.startsWith("/apple-touch-icon/") ||
    url.pathname === "/icon" ||
    url.pathname === "/apple-icon" ||
    url.pathname.startsWith("/manifest")
  ) {
    e.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  // Strony: network-first (świeże dane), offline → cache; dla nawigacji fallback na shell.
  e.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(request, clone));
        return res;
      })
      .catch(async () => {
        // ignoreVary: dokument HTML strony jest cache'owany bez wariantów RSC, a Next dodaje
        // `Vary: RSC,…`; bez ignoreVary match po nawigacji mógłby nie trafić w zbuforowany dokument.
        const cached = await caches.match(request, { ignoreVary: true });
        if (cached) return cached;
        // Offline nawigacja do trasy, której nie ma w cache → wpuść do aplikacji przez shell,
        // zamiast pokazywać błąd przeglądarki. Klient (Zakupy) dalej działa na lokalnym snapshotcie.
        if (request.mode === "navigate") {
          return (
            (await caches.match("/shopping", { ignoreVary: true })) ||
            (await caches.match("/", { ignoreVary: true })) ||
            Response.error()
          );
        }
        return Response.error();
      })
  );
});
