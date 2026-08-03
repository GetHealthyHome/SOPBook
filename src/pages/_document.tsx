import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        {/* Favicons are cached hard by browsers, so the ?v= is bumped whenever
            the mark changes. PNG fallbacks matter because the SVG mark is a
            transparent outline — it disappears at 16px against dark browser
            chrome, while these are composited on white. */}
        <link rel="icon" href="/logo.svg?v=3" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32.png?v=3" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16.png?v=3" type="image/png" sizes="16x16" />
        <meta name="theme-color" content="#065f46" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SOPBook" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="SOPBook" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
