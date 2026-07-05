const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    // API responses are per-user and change constantly — never let the
    // service worker cache them (stale data + private data lingering in
    // the browser cache on shared devices). Must come before the
    // default rules, since Workbox uses the first matching route.
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
