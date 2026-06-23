/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Prevent clickjacking
        { key: 'X-Frame-Options', value: 'DENY' },
        // Prevent MIME sniffing
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // Minimal referrer leakage
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Disable browser features not needed by the app
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), payment=()',
        },
        // Content Security Policy
        // - default-src: only same origin
        // - script-src: self + unsafe-inline required by Next.js 12 inline scripts
        // - img-src: self + data URIs + Unsplash (used for SOP step images)
        // - connect-src: self + Supabase API
        // - style-src: self + unsafe-inline required by Tailwind JIT
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://images.unsplash.com",
            "connect-src 'self' https://omxxjasmsjjuydaishcn.supabase.co",
            "font-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
        // Force HTTPS on subsequent visits (1 year, include subdomains)
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
        // Prevent caching of authenticated pages in shared proxies
        {
          key: 'Cache-Control',
          value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      ],
    },
  ],
};

module.exports = nextConfig;
