# Retrofit Field

Cross-platform (iOS/Android) field app for residential retrofit crews. Techs pull
their Housecall Pro jobs, photograph work with a burned-in time/GPS stamp, tag and
annotate the shot, and the photo uploads back to the job — whether or not there was
signal when they took it.

Built with Expo (SDK 53), React Native 0.79, TypeScript, expo-router and Zustand.

## Status

Feature-complete against the original brief. Typechecks, 51 tests pass.

- Housecall Pro client (`GET /jobs`, `GET /customers`, `POST /jobs/{id}/attachments`)
- SQLite schema with migrations, and repositories for jobs/customers/photos/queue
- Offline-first sync engine: atomic task claiming, jittered exponential backoff,
  crash recovery, connectivity-driven draining
- Zustand stores, design tokens, sync status bar, jobs/customers/queue tabs, job detail
- Camera capture with warmed-up GPS and a burned-in metadata stamp
- Annotation studio: Skia freehand, text tool, four high-visibility inks, flattening

**Not verified on hardware.** Nothing here has been run on a device or simulator.
The camera, GPS and Skia paths in particular are written against the documented
APIs but have never executed. See the open issues for what that leaves at risk.

## Getting started

```bash
cd mobile
npm install
cp .env.example .env.local     # optional; only points at an environment
npx expo start
```

The app asks for a Housecall Pro API key on first launch. It is verified against the
live API before being accepted, then stored in the iOS Keychain / Android Keystore.

`expo-camera`, `expo-location` and `expo-sqlite` all work in Expo Go for development.
A dev build (`npx expo prebuild && npx expo run:ios`) is needed for SQLCipher.

```bash
npm run typecheck
npm test
```

## Architecture

```
mobile/
├── app/                      # expo-router routes (file = screen)
│   ├── _layout.tsx           # bootstrap gate, auth redirect, sync bar
│   ├── sign-in.tsx           # API key entry, verified before it is stored
│   ├── (tabs)/               # Jobs · Customers · Queue
│   ├── job/[id].tsx          # job detail + captured photos + Take Photo
│   ├── capture/[jobId].tsx   # full-screen camera
│   └── review/[photoId].tsx  # tagging + annotation studio
└── src/
    ├── annotation/           # annotation model, letterbox geometry, flattening
    ├── api/                  # Housecall Pro client, wire→domain mappers, errors
    ├── auth/                 # Keychain-backed credential storage
    ├── capture/              # GPS warm-up, EXIF orientation, stamp renderer
    ├── components/           # SyncStatusBar, JobCard, AnnotationCanvas
    ├── db/                   # SQLite: schema, migrations, repositories
    ├── render/               # shared Skia surface/font/geometry helpers
    ├── state/                # Zustand stores
    ├── storage/              # photo files on disk
    ├── sync/                 # SyncEngine + backoff policy
    ├── theme/                # design tokens
    ├── types/                # domain.ts (ours) + housecallPro.ts (theirs)
    └── bootstrap.ts          # ordered startup
```

### Data flow

The rule that shapes everything: **the UI renders SQLite, never an API response.**

```
Housecall Pro ──fetch──> mappers ──write──> SQLite ──query──> Zustand ──> UI
```

A refresh writes to the database and then re-queries. Nothing sets store state from
a network response directly. This is what makes the online and offline paths the
same code path — a failed refresh leaves a fully usable screen with a banner, and
there is never a "fresh in memory, stale on disk" state to reason about.

Photos flow the other way and are **source of truth on the device**:

```
Camera ──stamp──> file on disk ──> photos row ──> upload_queue row
                                                        │
                                        SyncEngine ──POST──> Housecall Pro
                                                        │
                                            local file deleted, row marked uploaded
```

### The offline queue

`jobs` and `customers` are a disposable cache. `photos` and `upload_queue` are not —
they hold work that exists nowhere else until it uploads. A few decisions worth
knowing before changing `src/sync/SyncEngine.ts`:

- **Uploads are sequential.** Jobsite uplink is the bottleneck; three concurrent
  multipart posts on weak LTE finish slower in aggregate than three in series.
- **Task claiming is atomic** (`SELECT` + `UPDATE` in one transaction). Without it,
  a connectivity flap and a manual "Sync now" can both claim the same task and
  create a duplicate attachment on the job.
- **Backoff is jittered.** A crew of trucks leaving the same dead zone would
  otherwise retry in lockstep and hammer the API in synchronized waves.
- **Retries have a budget** (8 attempts). After that the task is *parked*, not
  deleted — the photo still matters, we just stop burning battery on it until the
  tech taps Retry.
- **Uploaded files are deleted from disk.** A 60-photo day fills a phone otherwise.
- **Sync runs in the foreground only.** True background upload needs
  `expo-background-task`; that changes the failure model enough to deserve its
  own pass.

### Security posture

Stated plainly, because "encrypted" is easy to over-claim:

| Asset | Protection |
| --- | --- |
| Housecall Pro API key | iOS Keychain / Android Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — never in the bundle, never in SQLite |
| Photo files | App sandbox under iOS Data Protection / Android FBE |
| SQLite queue | Same sandbox protection. **Not** separately encrypted by default |

`expo-sqlite` does not ship SQLCipher, so database-level encryption requires a dev
build compiled with it plus `EXPO_PUBLIC_SQLCIPHER=1`. `src/db/encryption.ts`
manages that key and is deliberately guarded: issuing `PRAGMA key` against stock
SQLite silently does nothing, which would leave you believing the DB is encrypted
when it is not.

Note that a Housecall Pro API key is company-wide. Putting one on every tech's phone
is a real blast-radius question — `EXPO_PUBLIC_TOKEN_BROKER_URL` is reserved for
brokering short-lived per-device tokens through a backend instead.

## Capture pipeline

```
shutter ──> takePictureAsync({exif:true})
        ──> Skia: rotate upright, downscale to 2560, burn stamp   [stampRenderer]
        ──> photos row (status: draft) ──> review screen
        ──> Skia: flatten annotations into a NEW file             [flatten]
        ──> photos row (status: pending) ──> upload_queue
```

Three things in there are load-bearing and easy to break:

- **Rotation is baked into pixels, not left to EXIF.** Skia ignores the EXIF
  orientation tag when decoding, so an unrotated draw would put the stamp in the
  wrong corner of what the viewer sees.
- **Annotations are stored normalized (0..1 in image space), never in screen
  points.** A stroke drawn on a 390pt preview has to land in the same place in a
  2560px export, and the photo is letterboxed inside its container.
- **Flattening writes a new file, then swaps.** Rendering in place means a crash
  mid-encode truncates the only copy of the photo.

## Next steps

Tracked as issues in [GetHealthyHome/CrewCam](https://github.com/GetHealthyHome/CrewCam/issues).
The largest by far is hardware validation — none of the native paths have run.
