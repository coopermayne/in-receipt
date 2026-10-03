// Warms the browser cache with exactly the files a project view will display,
// so opening a project feels instant. Index thumbnails are left to native
// eager/lazy loading — they never go through this queue.
//
// Order: whatever the visitor is pointing at or touching → projects visible
// on screen (only once the page has finished loading and the browser is idle).
import { getProjectData, type ResponsiveImage } from './projectData';

const DESKTOP = '(min-width: 768px)';
const CONCURRENCY = 3;
// Images that are on screen as soon as a project opens; the rest load natively
// (lazily) once it is open. Mobile's expanded view starts with the description,
// and background bytes cost more on a phone, so it warms fewer.
const IDLE_IMAGES_PER_PROJECT = { desktop: 4, mobile: 2 };
const INTENT_IMAGES_PER_PROJECT = 8;

type Job = { key: string; run: () => Promise<void> };

class WarmQueue {
  private high: Job[] = [];
  private low: Job[] = [];
  private active = 0;
  private seen = new Set<string>();

  add(job: Job, priority: 'high' | 'low') {
    if (this.seen.has(job.key)) {
      // Already queued at low priority: promote it
      if (priority === 'high') {
        const i = this.low.findIndex(j => j.key === job.key);
        if (i !== -1) this.high.push(...this.low.splice(i, 1));
      }
      return;
    }
    this.seen.add(job.key);
    (priority === 'high' ? this.high : this.low).push(job);
    this.pump();
  }

  private pump() {
    while (this.active < CONCURRENCY) {
      const job = this.high.shift() ?? this.low.shift();
      if (!job) return;
      this.active++;
      job.run().finally(() => {
        this.active--;
        this.pump();
      });
    }
  }
}

const queue = new WarmQueue();

// Detached image with the panel's own srcset + sizes, so the browser picks
// the same candidate the panel <img> will pick and the open is a cache hit.
function warmResponsive(img: ResponsiveImage): Promise<void> {
  return new Promise(resolve => {
    const el = new Image();
    el.onload = el.onerror = () => resolve();
    el.sizes = img.sizes;
    el.srcset = img.srcset;
    el.src = img.src;
  });
}

// Mobile expanded-gallery images are already in the DOM (lazy, hidden until
// the card opens); switching them to eager starts their own srcset fetch.
function warmElement(el: HTMLImageElement): Promise<void> {
  if (el.complete && el.naturalWidth > 0) return Promise.resolve();
  return new Promise(resolve => {
    el.addEventListener('load', () => resolve(), { once: true });
    el.addEventListener('error', () => resolve(), { once: true });
    el.loading = 'eager';
  });
}

function warmCard(card: HTMLElement, priority: 'high' | 'low') {
  const isMobileCard = card.closest('.gallery-row') !== null;
  const limit = priority === 'high'
    ? INTENT_IMAGES_PER_PROJECT
    : IDLE_IMAGES_PER_PROJECT[isMobileCard ? 'mobile' : 'desktop'];

  if (isMobileCard) {
    const imgs = card.querySelectorAll<HTMLImageElement>('.project-card__expanded-gallery img');
    [...imgs].slice(0, limit).forEach((el, i) =>
      queue.add({ key: `${card.dataset.projectId}:m${i}`, run: () => warmElement(el) }, priority)
    );
    return;
  }

  const data = getProjectData(card.dataset.projectId || '');
  if (!data) return;
  // Right-column cards open the right panel, which has its own sizes
  const images = card.closest('.gallery-column--right') ? data.rightPanelImages : data.leftPanelImages;
  images.slice(0, limit).forEach(img =>
    queue.add({ key: img.srcset || img.src, run: () => warmResponsive(img) }, priority)
  );
}

// Cards in the layout that is actually showing at this breakpoint
function activeCardSelector(): string {
  return matchMedia(DESKTOP).matches ? '.gallery-column .project-card' : '.gallery-row .project-card';
}

function onIdle(fn: () => void) {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

function saveData(): boolean {
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
}

function setupCardFadeIn() {
  const cardInners = document.querySelectorAll('.gallery-column .project-card__inner');

  cardInners.forEach(inner => {
    const img = inner.querySelector('.project-card__image') as HTMLImageElement;
    if (!img) return;

    if (img.complete && img.naturalHeight !== 0) {
      inner.classList.add('loaded');
    } else {
      img.addEventListener('load', () => {
        inner.classList.add('loaded');
      });
      img.addEventListener('error', () => {
        inner.classList.add('loaded');
      });
    }
  });
}

// Background warming: projects whose cards are on screen, after load
function setupIdleWarming() {
  if (saveData()) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      warmCard(entry.target as HTMLElement, 'low');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.5 });

  onIdle(() => {
    document.querySelectorAll<HTMLElement>(activeCardSelector()).forEach(card => observer.observe(card));
  });
}

// Intent warming: hover/focus on desktop, touchstart on mobile. Registered
// once on document so it survives Astro page swaps.
function onIntent(e: Event) {
  const card = (e.target as Element | null)?.closest?.('.project-card') as HTMLElement | null;
  if (card && card.matches(activeCardSelector())) warmCard(card, 'high');
}
document.addEventListener('pointerover', onIntent, { passive: true });
document.addEventListener('focusin', onIntent);
document.addEventListener('touchstart', onIntent, { passive: true });

function init() {
  // ClientRouter fires astro:page-load on the first load too; the body is
  // replaced on navigation, so this marks once per rendered page.
  if (document.body.dataset.preloaderInit) return;
  document.body.dataset.preloaderInit = 'true';
  setupCardFadeIn();
  setupIdleWarming();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-run on Astro page transitions
document.addEventListener('astro:page-load', init);
