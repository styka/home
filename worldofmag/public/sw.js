const CACHE = "worldofmag-v1";
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

// Fetch: network-first for API/server actions, cache-first for static assets
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never intercept server actions or API calls
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Cache-first for icons and static files
  if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/manifest")) {
    e.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Network-first for pages (always fresh data)
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
