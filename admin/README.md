# IN RECEIPT - Image Admin

Admin tool for managing the site's projects and images. Stores everything on
this host: content in SQLite, image originals on disk, resized derivatives
generated on demand.

## Requirements

**Environment Variables** (required):
- `ADMIN_USER` / `ADMIN_PASSWORD` - Basic auth credentials for the admin UI

Optional:
- `DATA_DIR` - Where persistent state lives (default `./data`, `/data` in the
  container). Must be a mounted volume in production.
- `NETLIFY_BUILD_HOOK` - Enables the publish button
- `NETLIFY_ACCESS_TOKEN` / `NETLIFY_SITE_ID` - Enables live deploy status

See `.env.example` in the repo root for the full list.

## Setup

```bash
cd admin
npm install
```

## Running

```bash
npm start
```

Then open http://localhost:3001

## Storage

Everything lives under `$DATA_DIR`:

```
db/content.db          SQLite, created and migrated on first boot (db.js)
originals/<id>.<ext>   uploaded files, untouched — the source of truth
cache/<id>/<size>.webp generated derivatives, safe to delete at any time
```

The database has one writer — this server — so there is no separate database
service to run.

**`originals/` and `db/` are the only copy of the content.** Back them up off
the host; a volume snapshot on the same machine is not a backup. `cache/` needs
no backup, it regenerates from the originals.

## Image delivery

`GET /img/:id/:width-:ratio-:fit-q:quality.webp` — e.g.
`/img/cedar-house/900-3x4-cover-q80.webp`. The derivative is rendered with
sharp on first request, written to `cache/`, and served from there afterwards
with a one-year immutable cache header.

Widths, ratios, fits and qualities are whitelisted in `images.js`; anything
else returns 400, so the cache can't be inflated by arbitrary requests. These
must stay in sync with `IMAGE_CONTEXTS` / `CROP_PRESETS` in
`src/lib/images.ts` — a size added there and not here will 400 at runtime.

URLs carry a `?v=` token derived from the upload timestamp so replacing an
image under an existing id isn't masked by the long cache lifetime.

## Features

- **Upload images** - Drag & drop or browse to upload images to local storage
- **Set focal point** - Click on the image to set the focal point for smart cropping
- **Crop preview** - See how the image will be cropped on mobile devices
- **Edit metadata** - Update alt text and focal point for existing images
- **Delete images** - Remove an image, its original and all its derivatives

## Public API

Two routes are served without authentication, ahead of the auth middleware:

- `GET /api/content` — everything the site needs to build, as
  `{ images: { [id]: ImageData }, projects: [Project] }`. The Netlify build
  fetches this; it carries no credentials, and this is the same data the
  published site exposes anyway.
- `GET /api/health` — liveness check.

Everything else requires basic auth.

## Using Images in Projects

Projects reference images by ID — `thumbnail` is a single ID, `images` is an
array of them. The site resolves those IDs to URLs and applies each image's
focal point as CSS `object-position` (see `src/lib/images.ts`).

The frontend resolves these IDs to `/img/...` URLs and applies the focal point for CSS `object-position`.
