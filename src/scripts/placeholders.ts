// Paints each image's ThumbHash as its background until the file loads.
// Images opt in with data-thumbhash (base64); the build already set the
// average color and background position inline (see placeholderFor in
// lib/images.ts), and CSS sizes the background to cover.
import { thumbHashToDataURL } from 'thumbhash';

// Most images render in several places (mobile and desktop markup, panels),
// so decode each hash once.
const decoded = new Map<string, string>();

function decode(hash: string): string | null {
  let url = decoded.get(hash);
  if (url === undefined) {
    try {
      const bytes = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
      url = thumbHashToDataURL(bytes);
    } catch {
      url = '';
    }
    decoded.set(hash, url);
  }
  return url || null;
}

// The placeholder must go once the image is in: transparent artwork would
// otherwise show it through.
function clear(img: HTMLImageElement) {
  img.style.backgroundImage = '';
  img.style.backgroundColor = '';
}

export function applyPlaceholder(img: HTMLImageElement) {
  const hash = img.dataset.thumbhash;
  if (!hash) return;

  if (img.complete && img.naturalWidth > 0) {
    clear(img);
    return;
  }

  const url = decode(hash);
  if (url) img.style.backgroundImage = `url(${url})`;
  img.addEventListener('load', () => clear(img), { once: true });
}

function init() {
  document
    .querySelectorAll<HTMLImageElement>('img[data-thumbhash]')
    .forEach(applyPlaceholder);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

document.addEventListener('astro:page-load', init);
