// Simmer service worker — app shell caching for offline support
// Bump this version string on every deploy to force cache invalidation.
const CACHE = "simmer-shell-v3";
const SHELL = ["/", "/manifest.json"];

// ── Install: pre-cache app shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    // Delete ALL caches at install time so the fresh SW always starts clean,
    // then pre-cache the minimal shell.
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => caches.open(CACHE).then((c) => c.addAll(SHELL)))
  );
  self.skipWaiting();
});

// ── Activate: purge any leftover stale caches ─────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// ── Message: allow the page to trigger immediate activation ───────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Never mediate cross-origin requests (Spoonacular/TheMealDB/blog images, Sentry, etc.).
  // The worker can't cache them anyway (opaque responses fail the res.ok gate), and re-issuing
  // the fetch from the worker context makes it subject to connect-src, which the page-level
  // img-src bypass does not cover — so third-party images 404'd under production CSP. Let the
  // browser fetch these directly as normal subresources (governed by img-src, which allows https:).
  if (new URL(request.url).origin !== self.location.origin) return;

  const url = new URL(request.url);

  // API calls: network-only (never serve stale API data from cache)
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: network-first, fall back to cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts): cache-first, populate on miss
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((c) => c.put(request, res.clone()));
        }
        return res;
      });
    })
  );
});
