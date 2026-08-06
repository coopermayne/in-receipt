import sharp from 'sharp';
import { mkdir, rename, rm, unlink, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { DATA_DIR } from './db.js';

export const ORIGINALS_DIR = join(DATA_DIR, 'originals');
export const CACHE_DIR = join(DATA_DIR, 'cache');

await mkdir(ORIGINALS_DIR, { recursive: true });
await mkdir(CACHE_DIR, { recursive: true });

// ============ TRANSFORM WHITELIST ============
// Derivatives are generated on demand, so the URL space must be bounded —
// otherwise anyone can fill the disk by requesting arbitrary sizes. These
// mirror IMAGE_CONTEXTS / CROP_PRESETS in src/lib/images.ts; when a size is
// added there, add it here too or the request 400s.

const ALLOWED_WIDTHS = new Set([
  150, 200, 250, 300, 350, 400, 450, 500, 600, 700,
  800, 900, 1000, 1200, 1600, 2000, 2560,
]);

const ALLOWED_QUALITIES = new Set([80, 90]);

// 'orig' keeps the source aspect ratio; the rest match CROP_PRESETS.
const ALLOWED_RATIOS = {
  orig: null,
  '3x4': [3, 4],
  '16x9': [16, 9],
  '1x1': [1, 1],
};

const ALLOWED_FITS = new Set(['scale-down', 'cover']);

// e.g. 900-3x4-cover-q80.webp  or  1600-orig-scale-down-q90.webp
const TRANSFORM_RE = /^(\d+)-([a-z0-9x]+)-(scale-down|cover)-q(\d+)\.webp$/;

// Image ids become path segments, so they must not be able to escape the
// storage directory or collide with the transform grammar.
const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export function isValidImageId(id) {
  return ID_RE.test(id);
}

// Returns a normalized transform, or null if anything falls outside the
// whitelist. Callers treat null as a 400.
export function parseTransform(transform) {
  const match = TRANSFORM_RE.exec(transform);
  if (!match) return null;

  const width = Number(match[1]);
  const ratioKey = match[2];
  const fit = match[3];
  const quality = Number(match[4]);

  if (!ALLOWED_WIDTHS.has(width)) return null;
  if (!ALLOWED_QUALITIES.has(quality)) return null;
  if (!ALLOWED_FITS.has(fit)) return null;
  if (!(ratioKey in ALLOWED_RATIOS)) return null;

  const ratio = ALLOWED_RATIOS[ratioKey];

  // A crop needs a target ratio; an uncropped resize must not have one.
  if (fit === 'cover' && !ratio) return null;
  if (fit === 'scale-down' && ratio) return null;

  return {
    width,
    height: ratio ? Math.round(width * (ratio[1] / ratio[0])) : null,
    fit,
    quality,
    filename: transform,
  };
}

// ============ STORAGE ============

export function originalPath(id, ext) {
  return join(ORIGINALS_DIR, `${id}.${ext}`);
}

function cachePath(id, filename) {
  return join(CACHE_DIR, id, filename);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const SUPPORTED_FORMATS = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  tiff: 'tiff',
  gif: 'gif',
};

// Writes the uploaded buffer to disk untouched — the original is the source
// of truth and everything else is regenerable from it. Returns the metadata
// the database needs.
export async function storeOriginal(id, buffer, filename) {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new Error('Unreadable image file');
  }

  const ext = SUPPORTED_FORMATS[metadata.format];
  if (!ext) {
    throw new Error(`Unsupported image format: ${metadata.format}`);
  }

  // EXIF orientation can swap the rendered axes; report what will be displayed
  // so the site's portrait/landscape logic matches the rendered image.
  const swapped = metadata.orientation >= 5 && metadata.orientation <= 8;
  const width = swapped ? metadata.height : metadata.width;
  const height = swapped ? metadata.width : metadata.height;

  await writeFile(originalPath(id, ext), buffer);

  return { ext, width, height, filename };
}

// Removes just the stored original, e.g. one orphaned by a format change.
export async function unlinkOriginal(id, ext) {
  await unlink(originalPath(id, ext)).catch(() => {});
}

// Drops every derivative of an image, e.g. after its original is replaced.
export async function clearCache(id) {
  await rm(join(CACHE_DIR, id), { recursive: true, force: true });
}

// Removes the original and every derivative of it.
export async function deleteStored(id, ext) {
  await unlink(originalPath(id, ext)).catch(() => {});
  await clearCache(id);
}

// ============ DERIVATIVES ============

// Concurrent requests for the same missing derivative would otherwise each
// run sharp; collapse them onto one job.
const inFlight = new Map();

async function generate(image, transform, destination) {
  const source = originalPath(image.id, image.ext);

  let pipeline = sharp(source).rotate(); // honor EXIF orientation

  if (transform.fit === 'cover') {
    // Crop around the focal point, using CSS object-position semantics: the
    // focal fraction of the scaled image is aligned with the same fraction of
    // the target box (offset = focal × (scaled − target)), which clamps at the
    // edges by construction. The admin's crop previews are object-position
    // over the full image, so they show exactly this crop.
    const tw = transform.width;
    const th = transform.height;
    const fx = image.focalPoint?.x ?? 0.5;
    const fy = image.focalPoint?.y ?? 0.5;

    const scale = Math.max(tw / image.width, th / image.height);
    const scaledW = Math.max(tw, Math.round(image.width * scale));
    const scaledH = Math.max(th, Math.round(image.height * scale));
    const left = Math.min(scaledW - tw, Math.max(0, Math.round(fx * (scaledW - tw))));
    const top = Math.min(scaledH - th, Math.max(0, Math.round(fy * (scaledH - th))));

    pipeline = pipeline
      .resize(scaledW, scaledH, { fit: 'fill' })
      .extract({ left, top, width: tw, height: th });
  } else {
    pipeline = pipeline.resize({
      width: transform.width,
      fit: 'inside',
      withoutEnlargement: true, // never upscale past the original
    });
  }

  const buffer = await pipeline.webp({ quality: transform.quality }).toBuffer();

  // Write then rename, so a reader never sees a half-written file.
  await mkdir(join(CACHE_DIR, image.id), { recursive: true });
  const temp = `${destination}.${process.pid}.tmp`;
  await writeFile(temp, buffer);
  await rename(temp, destination);
}

// Returns the path to the derivative, generating it if it isn't cached yet.
// Takes the full image record — cover crops depend on its focal point and
// stored dimensions, so callers that change the focal point must clearCache.
export async function getDerivative(image, transform) {
  const destination = cachePath(image.id, transform.filename);

  if (await exists(destination)) {
    return destination;
  }

  if (!inFlight.has(destination)) {
    const job = generate(image, transform, destination).finally(() => {
      inFlight.delete(destination);
    });
    inFlight.set(destination, job);
  }

  await inFlight.get(destination);
  return destination;
}

// Sizes generated in the background after upload, so the first visitor to a
// freshly published page doesn't pay for the resize. Not exhaustive — anything
// missed is generated on first request.
const WARM_TRANSFORMS = [
  '400-orig-scale-down-q80.webp',
  '800-orig-scale-down-q80.webp',
  '400-3x4-cover-q80.webp',
  '900-3x4-cover-q80.webp',
  '400-16x9-cover-q80.webp',
  '1600-orig-scale-down-q90.webp',
];

export function warmCache(image) {
  for (const name of WARM_TRANSFORMS) {
    const transform = parseTransform(name);
    if (!transform) continue;
    getDerivative(image, transform).catch((error) => {
      console.error(`Cache warm failed for ${image.id}/${name}:`, error.message);
    });
  }
}
