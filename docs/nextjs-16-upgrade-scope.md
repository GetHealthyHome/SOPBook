# Scope: Next.js 12 → 16 upgrade

> **Done.** Completed in one sitting. This document is kept as the record of
> what was predicted versus what actually happened — see *Outcome* at the end.

Written to close the one finding left open by the August 2026 security review:
Next 12 is end of life and no longer receives security patches. Seven npm
advisories trace to it or to `next-pwa`. None is reachable at runtime in
production today, so this is scheduled work, not an incident.

## Headline

**This is a much smaller job than the version numbers suggest.** Four major
versions sounds alarming, but almost everything that breaks between Next 12 and
16 lives in APIs this app does not use. The real work is one thing: replacing
the service worker plugin.

Estimate: **3–4 focused days**, one deploy, done by one person.

## Correction to the security review

PR #60 stated the upgrade "spans React 19". That was wrong, and it made the job
look bigger than it is. Next 16.3.0 declares:

```
peerDependencies: { react: "^18.2.0 || ^19.0.0", react-dom: "^18.2.0 || ^19.0.0" }
engines:          { node: ">=20.9.0" }
```

React 18.2.0 — what this app already runs — is fully supported. **No React
upgrade is required**, which removes the largest source of risk. React 19 can be
considered later as its own separate decision.

Node is fine too: the Vercel project already runs Node 24.x against a `>=20.9.0`
requirement.

## What actually breaks

The migration surface was measured against this codebase, not assumed.

| Common breaking change | Applies here? | Evidence |
| --- | --- | --- |
| App Router migration | **No** | Pages Router only, no `src/app` directory. Pages Router remains supported. |
| `getServerSideProps` / `getStaticProps` changes | **No** | Zero occurrences. Every page is client-fetched through `/api/*`. |
| `next/image` config and behaviour | **No** | Not imported anywhere. All images are plain `<img>`. |
| `next/link` `legacyBehavior` removal | **No** | Not imported anywhere. Navigation is internal React state. |
| Async `params` / `searchParams` (Next 15) | **No** | App Router only. |
| `fetch` caching default change (Next 15) | **No** | App Router only. |
| Font optimisation changes | **No** | No `next/font`, no Google Fonts link, no `@import`. System font stack. |
| `next.config.js` option removals | **Minimal** | Only `headers` is configured. No `images`, `i18n`, `experimental`, `webpack()`, `swcMinify`, `output`, `basePath`, `rewrites` or `redirects`. |
| API route `export const config` | **Verify** | Used in 3 routes for `bodyParser: false` (`upload`, `sops/import`, `training/import`). Supported in Pages Router; confirm the syntax is unchanged. |
| `next/document`, `next/app` | **Verify** | Both used, but in their plainest form — no `getInitialProps`, no custom document logic. |
| ESLint | **Yes, small** | `eslint-config-next@16` requires `eslint >=9`; the project is on 8.49 with `.eslintrc.json`. Needs flat-config migration. Dev-only, cannot affect production. |
| `next lint` command | **Yes, small** | Deprecated in recent versions in favour of calling ESLint directly. `package.json` still uses it. |

The entire Next.js API surface this app touches is four imports:

```
26x  from 'next'           (NextApiRequest / NextApiResponse types)
 1x  from 'next/head'
 1x  from 'next/document'
 1x  from 'next/app'
```

That is an unusually small blast radius for a four-major-version jump, and it
is the reason this is estimated in days rather than weeks.

## The one substantial piece: the service worker

This is where the real work and the real risk are.

`next-pwa@5.6.0` was **last published in August 2022** — roughly four years
unmaintained. It is the source of four of the seven remaining advisories
(`workbox-build`, `workbox-webpack-plugin`, `rollup-plugin-terser`,
`serialize-javascript`), all in its build-time chain. It will not work with
modern Next.

### Replacement: `@serwist/next`

| package | latest | last published | requires |
| --- | --- | --- | --- |
| `next-pwa` | 5.6.0 | **Aug 2022** | `next >=9` |
| `@ducanh2912/next-pwa` | 10.2.9 | Sep 2024 | `next >=14` |
| `@serwist/next` | 9.5.12 | **Jul 2026** | `next >=14`, `react >=18`, `typescript >=5` |

`@serwist/next` is the actively maintained successor and the clear choice.
`@ducanh2912/next-pwa` is the intermediate fork and is itself now going stale.

Note the ordering constraint: **Serwist requires Next ≥ 14**, so Next must be
upgraded first or in the same change. There is no intermediate state where the
old plugin runs on the new framework.

### What porting involves

Serwist uses a different authoring model. Today the caching strategy is a
declarative `runtimeCaching` array in `next.config.js`; Serwist has you write a
service worker entry in TypeScript. Four hand-written rules must be ported, plus
whatever of the `next-pwa/cache` defaults are worth keeping — Serwist does not
provide that default list verbatim:

1. **Video — `NetworkOnly`.** Deliberate: never cache video, to protect storage
   on crew phones. The next-pwa defaults would `CacheFirst` it, which is why
   rule order matters today.
2. **`/api/auth/me` — `NetworkFirst`,** 3s timeout, 8h expiry, bounded to the
   session lifetime so a cached copy never outlives the cookie it mirrors.
3. **SOP/training/handbook/career/badges GET — `NetworkFirst`,** 5s timeout,
   7-day expiry, 64 entries. This is what lets crews read procedures with no
   signal.
4. **All other `/api/*` — `NetworkOnly`.** Mutations and admin traffic must
   never be cached.

Rule 3 is the one that matters operationally. A crew member in a basement or
attic with no signal relies on it to open an SOP. If it regresses, the app looks
fine in the office and fails in the field — which is the worst possible failure
mode for this particular product.

## Sequencing

1. **ESLint 9 + flat config first**, on its own. Dev-only, zero production risk,
   and gets a fiddly unrelated change out of the way.
2. **Next 12 → 16 with the PWA temporarily disabled.** Isolates framework
   breakage from service-worker breakage. Verify build, every view, every API
   route.
3. **Add `@serwist/next` and port the four caching rules.** Verify online.
4. **Offline verification.** The step that cannot be skipped.
5. **Deploy, then confirm the service worker actually updates on devices that
   already have the old one installed.**

Splitting 2 and 3 matters. Doing them together means any breakage has two
possible causes and the debugging doubles.

## Testing scope

Surface to cover: **26 API routes**, **15 views**, ~6,100 lines in `index.tsx`.
There is no automated test suite, so this is manual.

**Auth and permissions** — sign in as admin and as a regular user; confirm admin
controls appear only for admins; confirm the live session checks added in PR #60
still behave (demotion, deletion, password reset all end the session).

**Content paths** — read an SOP end to end; complete a training module; sign off
a step; acknowledge a handbook section; open a safety module; run a search;
check career ladder and badges.

**Admin paths** — create and edit an SOP; upload a photo (this exercises
`bodyParser: false`, one of the three routes flagged above); import a PDF (also
`bodyParser: false`, and the `pdf-parse` deep import that already broke once
under a version change); add and reorder safety modules; reset a password.

**PWA behaviour** — install to home screen; confirm the icons and manifest still
resolve; **go offline and confirm SOPs and training still open**; confirm video
is not cached; confirm a logged-in session survives a cold offline start;
confirm mutations fail cleanly rather than silently queueing.

**Update path** — the highest-risk item after offline. Devices already carrying
the `next-pwa` service worker must cleanly replace it with the Serwist one. A
stale service worker that refuses to update is the classic PWA failure, and it
is invisible from a fresh browser profile. Test on a device that has the current
app installed, not a clean one.

## Risks

- **Service worker regression is invisible in the office.** Everything works on
  good wifi. Offline testing is not optional.
- **Stale service worker on installed devices.** Test the upgrade path on a
  phone that already has the app, not a fresh install.
- **`pdf-parse` deep import.** Already broke once (`DOMMatrix is not defined`)
  and is pinned to 1.1.1 with a hand-written type declaration. A bundler change
  could disturb it. Import is covered in the admin test path above.
- **No test suite.** Every regression must be caught by hand, which is the
  single largest cost driver in the estimate.
- **Changelogs not yet read.** nextjs.org was unreachable from the environment
  this scope was written in. The codebase inventory above is authoritative — it
  was measured, not assumed — but whoever does the work should still read the
  12→13, 13→14, 14→15 and 15→16 upgrade guides for anything the inventory could
  not anticipate. Budget half a day for that and treat the estimate as
  provisional until it is done.

## Rollback

Vercel keeps previous deployments, so rollback is a promotion of the prior
build. The one thing that does **not** roll back cleanly is the service worker:
devices that have already installed the Serwist worker keep it. If the upgrade
is reverted, the old worker must be republished and given time to propagate.
Worth a deliberate decision before deploying, not after.

## Recommendation

Schedule it as a single 3–4 day block rather than splitting it across weeks —
the offline and update-path testing needs the whole change present to be
meaningful. There is no urgency in the sense of active exploitability, but the
gap widens every month Next 12 goes unpatched, so it belongs on a calendar
rather than a backlog.


---

# Outcome

Implemented in a single pass. Every version is as predicted: **Next 16.3.1,
React unchanged at 18.2.0, Node already sufficient.**

## What the estimate got right

The inventory held. The build compiled on Next 16 **on the first attempt**,
with no source changes at all — no page, component or API route needed
touching. The framework surface really was four imports, and none of them
moved. Security headers, the API `no-store` policy and every route survived
untouched.

## What the estimate got wrong

**The ESLint step could not be done first.** The plan called for it as an
isolated, zero-risk warm-up, but `eslint-config-next` is versioned with Next
and 16 requires ESLint 9, so the two had to move together. The sequencing was
wrong on a point the plan was confident about.

**Turbopack was not anticipated at all.** Next 16 enables it by default, and
`@serwist/next` 9.5.12 is webpack-only, so the build fails outright with a
webpack config present. The build script now passes `--webpack`.

That failure was loud, which was lucky. The tempting fix — silencing the
warning with an empty `turbopack: {}` — produces a clean build **and no
service worker at all**, which is precisely the "works in the office, fails in
the field" outcome this document warned about.

## The regression the plan predicted, and the tests caught

next-pwa registered a `start-url` route automatically. Because it never
appeared in the config being ported, it was invisible during the port — the
four documented rules were carried across faithfully and the fifth,
undocumented one was dropped.

The result: every piece of reference data cached correctly, and the app itself
would not open without a network. A tech in a basement would have had a
perfectly populated cache behind a browser error page. Caught by the offline
test, fixed with an explicit navigation rule.

## Verification actually performed

17 browser assertions against a production build in headless Chromium:

- **Offline (8)** — worker registers and controls; app shell precached (19
  entries); the reference-content rule creates its cache; a navigation is
  cached; **SOP data served from cache with the network off**; **the app opens
  with the network off**; video never cached anywhere.
- **Upgrade path (5)** — with next-pwa's caches and registration present, the
  new worker takes over, exactly one registration remains, none stuck waiting,
  and the app still renders.
- **Stale cache sweep (4)** — on first activation the old `workbox-*` and
  `start-url` caches are deleted and Serwist's own are left intact. This was
  added after noticing the orphans survived; an app that avoids caching video
  to protect a tech's storage should not abandon caches on their phone either.

## Security result

**Zero advisories**, from 8 at the start of this work and 18 when the audit
began. The last two needed a `postcss` bump on a direct pin that Next no
longer constrained.

## Left undone

The 11 React Compiler lint errors that Next 16's config introduces are set to
warn rather than error. They flag long-standing patterns — a reset on prop
change, effects that set state on mount, lazy loading on first view, a timer
in a ref — none of which is a bug, and none of which has any effect under
React 18 without the compiler. Fixing them is a real refactor and belongs in
its own change, not bolted onto a framework upgrade.
