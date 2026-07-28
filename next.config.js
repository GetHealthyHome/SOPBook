const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
  // Order matters: Workbox uses the first matching route, so the
  // specific rules below must come before the next-pwa defaults.
  runtimeCaching: [
    // Video is deliberately never cached — respects mobile storage
    // limits on BYOD phones. (The next-pwa defaults would CacheFirst
    // it, so this bypass must be registered first.)
    {
      urlPattern: ({ request, url }) =>
        request.destination === 'video' || /\.(?:mp4|webm|mov|m4v|avi)$/i.test(url.pathname),
      handler: 'NetworkOnly',
    },
    // Session check: cached so the installed app can restore a
    // logged-in session while offline. Bounded to the 8-hour session
    // lifetime so a cached copy never outlives the cookie it mirrors.
    {
      urlPattern: ({ url }) => url.pathname === '/api/auth/me',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'session-check',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 1, maxAgeSeconds: 8 * 60 * 60 },
        cacheableResponse: { statuses: [200] },
      },
    },
    // Reference content (SOPs, training, handbook, career, badges):
    // network-first so crews always see fresh procedures when online,
    // with the last good copy served instantly when the network is
    // slow (5s timeout) or gone. GET only — mutations never cache.
    {
      urlPattern: ({ url }) =>
        /^\/api\/(?:sops|training|handbook|career|badges)(?:\/|$)/.test(url.pathname),
      method: 'GET',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'sop-data',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [200] },
      },
    },
    // Everything else under /api/ (auth mutations, admin, uploads,
    // notifications) is volatile or sensitive — never cached.
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    ...require('next-pwa/cache'),
  ],
});

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-eval is only needed by the dev-mode bundler
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      // Uploaded photos live on Supabase storage; admins may also link
      // photos hosted elsewhere — any https image host is allowed
      // (images render only, they cannot run script)
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
];

const nextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
    {
      // Only API responses carry user data — static assets stay cacheable
      // so pages load fast instead of re-downloading everything each visit.
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
      ],
    },
  ],
};

module.exports = withPWA(nextConfig);
