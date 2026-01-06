// Prioritized image loading with Intersection Observer
// Load order: visible thumbnails → next thumbnails → gallery images as user scrolls

interface ResponsiveImage {
  id: string;
  src: string;
  srcset: string;
  sizes: string;
  focalPoint: string;
  alt: string;
}

interface ProjectData {
  leftPanelImages?: ResponsiveImage[];
  rightPanelFeatured?: ResponsiveImage | null;
  year?: string;
  location?: string;
  type?: string;
}

// Track which images have been queued to avoid duplicates
const queuedImages = new Set<string>();
const loadedImages = new Set<string>();

// Promise-based image loader
function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (loadedImages.has(src)) {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => {
      loadedImages.add(src);
      resolve();
    };
    img.onerror = () => {
      resolve(); // Don't block queue on errors
    };
    img.src = src;
  });
}

// Sequential loader - loads images one at a time in priority order
class ImageLoadQueue {
  private queue: string[] = [];
  private isProcessing = false;

  add(src: string, priority: 'high' | 'normal' = 'normal') {
    if (queuedImages.has(src)) return;
    queuedImages.add(src);

    if (priority === 'high') {
      this.queue.unshift(src);
    } else {
      this.queue.push(src);
    }

    this.process();
  }

  addMultiple(srcs: string[], priority: 'high' | 'normal' = 'normal') {
    srcs.forEach(src => this.add(src, priority));
  }

  private async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const src = this.queue.shift()!;
      await loadImage(src);
    }

    this.isProcessing = false;
  }
}

const imageQueue = new ImageLoadQueue();

function getProjectData(card: HTMLElement): { thumbnail: string; images: string[] } {
  const thumbnail = card.querySelector('.project-card__image')?.getAttribute('src') || '';
  try {
    const projectData: ProjectData = JSON.parse(card.dataset.projectData || '{}');
    // Extract src URLs from leftPanelImages (these are the largest desktop versions)
    const imageSrcs = (projectData.leftPanelImages || []).map(img => img.src);
    return { thumbnail, images: imageSrcs };
  } catch {
    return { thumbnail, images: [] };
  }
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

function setupPrioritizedLoading() {
  // Get all gallery rows (mobile) and columns (desktop)
  const rows = document.querySelectorAll('.gallery-row');
  const columns = document.querySelectorAll('.gallery-column');

  // Priority 1: First project in each row/column (thumbnails already eager, but queue gallery)
  const firstCards: HTMLElement[] = [];

  rows.forEach(row => {
    const firstCard = row.querySelector('.project-card') as HTMLElement;
    if (firstCard) firstCards.push(firstCard);
  });

  columns.forEach(col => {
    const firstCard = col.querySelector('.project-card') as HTMLElement;
    if (firstCard && !firstCards.includes(firstCard)) {
      firstCards.push(firstCard);
    }
  });

  // Load first project gallery images with high priority
  firstCards.forEach(card => {
    const { images } = getProjectData(card);
    imageQueue.addMultiple(images, 'high');
  });

  // Priority 2: Second project thumbnails + gallery (load after first projects)
  setTimeout(() => {
    rows.forEach(row => {
      const cards = row.querySelectorAll('.project-card');
      if (cards[1]) {
        const { thumbnail, images } = getProjectData(cards[1] as HTMLElement);
        imageQueue.add(thumbnail, 'normal');
        imageQueue.addMultiple(images, 'normal');
      }
    });
  }, 100);

  // Intersection Observer for remaining cards
  const observerOptions = {
    root: null,
    rootMargin: '100% 0px', // Trigger one viewport ahead
    threshold: 0
  };

  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target as HTMLElement;
        const { thumbnail, images } = getProjectData(card);

        // Queue thumbnail first, then gallery images
        imageQueue.add(thumbnail, 'normal');
        imageQueue.addMultiple(images, 'normal');

        // Stop observing once queued
        cardObserver.unobserve(card);
      }
    });
  }, observerOptions);

  // Observe all cards except first ones (already handled)
  const allCards = document.querySelectorAll('.project-card');
  allCards.forEach((card, index) => {
    // Skip first card in each container (index 0 in each row/column)
    const isFirst = card.parentElement?.querySelector('.project-card') === card;
    if (!isFirst) {
      cardObserver.observe(card);
    }
  });
}

function init() {
  setupCardFadeIn();
  setupPrioritizedLoading();
}

// Run after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-run on Astro page transitions
document.addEventListener('astro:page-load', init);
