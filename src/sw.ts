/// <reference lib="webworker" />
/**
 * Service worker — offline behaviour for the Field Guide.
 *
 * Ported from the runtimeCaching array that lived in next.config.js under
 * next-pwa. Serwist has you write the worker rather than declare it, so the
 * rules are code now; the behaviour is deliberately unchanged.
 *
 * Order matters. Serwist uses the first route whose matcher returns true, so
 * the specific rules below must come before `defaultCache`, which is broad.
 */
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Video is never cached, deliberately: crews are on their own phones and
    // a cached site video can eat storage they need for photos. The default
    // rules below would CacheFirst it, which is why this comes first.
    {
      matcher: ({ request, url }) =>
        request.destination === 'video' || /\.(?:mp4|webm|mov|m4v|avi)$/i.test(url.pathname),
      handler: new NetworkOnly(),
    },

    // Session check. Cached so the installed app can restore a signed-in
    // session with no signal, and bounded to the 8-hour session lifetime so a
    // cached copy never outlives the cookie it mirrors.
    {
      matcher: ({ url }) => url.pathname === '/api/auth/me',
      handler: new NetworkFirst({
        cacheName: 'session-check',
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 8 * 60 * 60 })],
      }),
    },

    // Reference content: SOPs, training, handbook, career, badges.
    //
    // This is the rule that matters in the field. Network-first so a tech
    // always sees current procedures when there is signal, falling back to the
    // last good copy when the network is slow (5s) or absent — which is what
    // lets someone open an SOP in a basement or an attic.
    //
    // GET only. A mutation must never be served from cache.
    {
      matcher: ({ url, request }) =>
        request.method === 'GET' &&
        /^\/api\/(?:sops|training|handbook|career|badges)(?:\/|$)/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: 'sop-data',
        networkTimeoutSeconds: 5,
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },

    // Everything else under /api/ is volatile or sensitive — auth mutations,
    // admin actions, uploads, incident reports, the OSHA PDFs. Never cached.
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },

    // The page itself.
    //
    // next-pwa registered a `start-url` route for this automatically, so it
    // never appeared in the config being ported and was easy to miss. Without
    // it the worker caches all the data a tech needs and then the app will not
    // open to show it — the browser's own offline error appears instead. That
    // fails in exactly the place the offline support exists for.
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 5,
        plugins: [new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },

    // Static assets, fonts, images, Next's own chunks.
    ...defaultCache,
  ],
});

// Sweep up after next-pwa. A phone that had the app installed before this
// upgrade still carries its Workbox precache and its `start-url` cache, which
// nothing will ever read again. Serwist only manages its own caches, so
// without this they sit on the device indefinitely — and this app goes out of
// its way not to waste storage on someone's own phone.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name.startsWith('workbox-') || name === 'start-url')
          .map(name => caches.delete(name)),
      ),
    ),
  );
});

serwist.addEventListeners();
