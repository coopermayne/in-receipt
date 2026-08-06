import { fetchImages, MEDIA_BASE_URL, type ImageData } from './content';

// Module-level cache for images data
let imagesData: Record<string, ImageData> | null = null;

// Initialize images from Supabase (call once at page level)
export async function initImages(): Promise<void> {
  if (imagesData === null) {
    imagesData = await fetchImages();
  }
}

// Type definitions
interface ImageOptions {
  width: number;
  // Aspect ratio key, e.g. '3x4'. Omitted or 'orig' keeps the source ratio.
  ratio?: string;
  fit?: 'scale-down' | 'cover';
  quality?: number;
}

interface CropPreset {
  ratio: [number, number]; // [width, height]
  fit: 'cover';
}

// ===========================================
// IMAGE CONTEXT CONFIGURATIONS
// Each context has specific sizes based on actual rendered dimensions
// ===========================================

export const IMAGE_CONTEXTS = {
  // Mobile index thumbnails (100vw, high DPR devices)
  // Rendered: 320-428px, need up to 3x for retina
  mobileThumb: {
    widths: [400, 600, 900],
    sizes: '100vw',
  },

  // Mobile expanded gallery (100vw - 32px padding)
  // Rendered: ~340-400px, need up to 2x for retina
  mobileGallery: {
    widths: [400, 600, 800],
    sizes: 'calc(100vw - 32px)',
  },

  // Desktop big projects column thumbnail
  // CSS: max-width 24vw, max-height 50vh, object-fit: contain
  // @1440: 346px, @1920: 461px, @2560: 614px → 2x = 1228px
  desktopBigThumb: {
    widths: [300, 400, 500, 700, 1000],
    sizes: '24vw',
  },

  // Desktop small projects column thumbnail
  // CSS: max-width 12vw, max-height 30vh, object-fit: contain
  // @1440: 173px, @1920: 230px, @2560: 307px → 2x = 614px
  desktopSmallThumb: {
    widths: [150, 200, 300, 450],
    sizes: '12vw',
  },

  // Desktop left panel gallery (2-column grid inside 44.3vw panel)
  // Each image ~21vw: @1440: 302px, @1920: 403px → 2x = 806px
  leftPanelGallery: {
    widths: [250, 350, 450, 600, 800],
    sizes: '21vw',
  },

  // Desktop right panel gallery images (scrollable, tall)
  // CSS: 18.2vw width, variable height
  // @1440: 262px, @1920: 350px → 2x = 700px
  rightPanelGallery: {
    widths: [200, 300, 400, 600],
    sizes: '18.2vw',
  },

  // Lightbox: full-screen high quality
  // Max viewport ~2560px, need up to 2x for retina = 5120px
  // Using sizes for progressive loading
  lightbox: {
    widths: [800, 1200, 1600, 2000, 2560],
    sizes: '100vw',
  },
} as const;

// Crop presets for enforced aspect ratios
export const CROP_PRESETS = {
  // Mobile big projects: 60% of viewport height, portrait feel
  mobileBig: { ratio: [3, 4], fit: 'cover' } as CropPreset,
  // Mobile small projects: 40% of viewport height, landscape feel
  mobileSmall: { ratio: [16, 9], fit: 'cover' } as CropPreset,
  // Desktop small projects square crop (when original is landscape)
  desktopSmallSquare: { ratio: [1, 1], fit: 'cover' } as CropPreset,
} as const;

// ===========================================
// CORE FUNCTIONS
// ===========================================

// Get image data by ID
export function getImage(id: string): ImageData | null {
  if (!imagesData) {
    throw new Error('Images not initialized. Call initImages() first.');
  }
  return imagesData[id] || null;
}

// Check if image exists
export function hasImage(id: string): boolean {
  if (!imagesData) {
    throw new Error('Images not initialized. Call initImages() first.');
  }
  return id in imagesData;
}

// Get focal point as CSS object-position value
export function getFocalPointStyle(id: string): string {
  const image = getImage(id);
  if (!image?.focalPoint) return '50% 50%';
  const x = Math.round(image.focalPoint.x * 100);
  const y = Math.round(image.focalPoint.y * 100);
  return `${x}% ${y}%`;
}

// Determine if an image is landscape, portrait, or square
export function getOrientation(id: string): 'landscape' | 'portrait' | 'square' {
  const image = getImage(id);
  if (!image) return 'square';

  const ratio = image.width / image.height;
  if (ratio > 1.05) return 'landscape';
  if (ratio < 0.95) return 'portrait';
  return 'square';
}

// Build a media URL. The path is the transform, so every derivative is an
// immutable, independently cacheable URL. The server whitelists these — see
// ALLOWED_WIDTHS / ALLOWED_RATIOS in admin/images.js. Keep them in sync.
export function getImageUrl(id: string, options: ImageOptions): string {
  const image = getImage(id);
  if (!image) {
    console.warn(`Image not found: ${id}`);
    return '';
  }

  const ratio = options.ratio || 'orig';
  const fit = options.fit || 'scale-down';
  const quality = options.quality || 80;

  // Responses are cached for a year, so replacing an image under the same id
  // has to change its URL or browsers would keep the old bytes. The upload
  // timestamp does that; the server ignores the parameter.
  const timestamp = Date.parse(image.uploadedAt);
  const version = Number.isNaN(timestamp) ? '0' : timestamp.toString(36);

  return `${MEDIA_BASE_URL}/img/${id}/${options.width}-${ratio}-${fit}-q${quality}.webp?v=${version}`;
}

// Turn a crop preset's ratio into its URL key, e.g. [3, 4] -> '3x4'.
function ratioKey(crop: CropPreset): string {
  return `${crop.ratio[0]}x${crop.ratio[1]}`;
}

// The server derives the pixel height from the ratio key, so only the width
// and the crop shape need to travel in the URL.
function buildOptions(
  width: number,
  crop: CropPreset | null,
  quality: number
): ImageOptions {
  return crop
    ? { width, ratio: ratioKey(crop), fit: crop.fit, quality }
    : { width, fit: 'scale-down', quality };
}

// Build srcset for a specific context
function buildSrcset(
  id: string,
  widths: readonly number[],
  crop: CropPreset | null,
  quality = 80
): string {
  return widths
    .map(w => `${getImageUrl(id, buildOptions(w, crop, quality))} ${w}w`)
    .join(', ');
}

// Get default src (middle size from widths array)
function getDefaultSrc(
  id: string,
  widths: readonly number[],
  crop: CropPreset | null,
  quality = 80
): string {
  const middleIndex = Math.floor(widths.length / 2);
  const width = widths[middleIndex];

  return getImageUrl(id, buildOptions(width, crop, quality));
}

// ===========================================
// CONTEXT-SPECIFIC IMAGE GETTERS
// ===========================================

export interface ResponsiveImage {
  src: string;
  srcset: string;
  sizes: string;
  focalPoint: string;
  alt: string;
}

// Mobile thumbnail (for index rows)
export function getMobileThumbnail(
  id: string,
  category: 'big' | 'small'
): ResponsiveImage {
  const image = getImage(id);
  if (!image) {
    return { src: '', srcset: '', sizes: '', focalPoint: '50% 50%', alt: '' };
  }

  const crop = category === 'big'
    ? CROP_PRESETS.mobileBig
    : CROP_PRESETS.mobileSmall;

  const ctx = IMAGE_CONTEXTS.mobileThumb;

  return {
    src: getDefaultSrc(id, ctx.widths, crop),
    srcset: buildSrcset(id, ctx.widths, crop),
    sizes: ctx.sizes,
    focalPoint: getFocalPointStyle(id),
    alt: image.alt,
  };
}

// Desktop thumbnail (for column cards)
export function getDesktopThumbnail(
  id: string,
  category: 'big' | 'small'
): ResponsiveImage {
  const image = getImage(id);
  if (!image) {
    return { src: '', srcset: '', sizes: '', focalPoint: '50% 50%', alt: '' };
  }

  // Small projects: crop to square if landscape
  let crop: CropPreset | null = null;
  if (category === 'small' && getOrientation(id) === 'landscape') {
    crop = CROP_PRESETS.desktopSmallSquare;
  }

  const ctx = category === 'big'
    ? IMAGE_CONTEXTS.desktopBigThumb
    : IMAGE_CONTEXTS.desktopSmallThumb;

  return {
    src: getDefaultSrc(id, ctx.widths, crop),
    srcset: buildSrcset(id, ctx.widths, crop),
    sizes: ctx.sizes,
    focalPoint: getFocalPointStyle(id),
    alt: image.alt,
  };
}

// Mobile expanded gallery image
export function getMobileGalleryImage(id: string): ResponsiveImage {
  const image = getImage(id);
  if (!image) {
    return { src: '', srcset: '', sizes: '', focalPoint: '50% 50%', alt: '' };
  }

  const ctx = IMAGE_CONTEXTS.mobileGallery;

  return {
    src: getDefaultSrc(id, ctx.widths, null),
    srcset: buildSrcset(id, ctx.widths, null),
    sizes: ctx.sizes,
    focalPoint: getFocalPointStyle(id),
    alt: image.alt,
  };
}

// Desktop left panel gallery image
export function getLeftPanelGalleryImage(id: string): ResponsiveImage {
  const image = getImage(id);
  if (!image) {
    return { src: '', srcset: '', sizes: '', focalPoint: '50% 50%', alt: '' };
  }

  const ctx = IMAGE_CONTEXTS.leftPanelGallery;

  return {
    src: getDefaultSrc(id, ctx.widths, null),
    srcset: buildSrcset(id, ctx.widths, null),
    sizes: ctx.sizes,
    focalPoint: getFocalPointStyle(id),
    alt: image.alt,
  };
}

// Desktop right panel gallery images
export function getRightPanelGalleryImage(id: string): ResponsiveImage {
  const image = getImage(id);
  if (!image) {
    return { src: '', srcset: '', sizes: '', focalPoint: '50% 50%', alt: '' };
  }

  const ctx = IMAGE_CONTEXTS.rightPanelGallery;

  return {
    src: getDefaultSrc(id, ctx.widths, null),
    srcset: buildSrcset(id, ctx.widths, null),
    sizes: ctx.sizes,
    focalPoint: getFocalPointStyle(id),
    alt: image.alt,
  };
}

// Lightbox full-screen image (high quality)
export function getLightboxImage(id: string): ResponsiveImage {
  const image = getImage(id);
  if (!image) {
    return { src: '', srcset: '', sizes: '', focalPoint: '50% 50%', alt: '' };
  }

  const ctx = IMAGE_CONTEXTS.lightbox;

  return {
    src: getDefaultSrc(id, ctx.widths, null, 90), // Higher quality for lightbox
    srcset: buildSrcset(id, ctx.widths, null, 90),
    sizes: ctx.sizes,
    focalPoint: getFocalPointStyle(id),
    alt: image.alt,
  };
}

// Export all image IDs for reference
export function getAllImageIds(): string[] {
  if (!imagesData) {
    throw new Error('Images not initialized. Call initImages() first.');
  }
  return Object.keys(imagesData);
}
