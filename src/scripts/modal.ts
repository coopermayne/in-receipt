// Sliding panel logic for desktop project pages
import { getProjectData, type ProjectData } from './projectData';
import { applyPlaceholder, decode as decodeThumbHash } from './placeholders';

const mainGallery = document.querySelector('.main-gallery') as HTMLElement;
const leftPanel = document.getElementById('project-page-left') as HTMLDivElement;
const rightPanel = document.getElementById('project-page-right') as HTMLDivElement;

function populatePanel(panel: HTMLDivElement, projectData: ProjectData, isRightPanel: boolean = false) {
  const yearEl = panel.querySelector('[data-field="year"]') as HTMLSpanElement;
  const locationEl = panel.querySelector('[data-field="location"]') as HTMLSpanElement;
  const typeEl = panel.querySelector('[data-field="type"]') as HTMLSpanElement;
  const descEl = panel.querySelector('[data-field="description"]') as HTMLParagraphElement;
  const galleryEl = panel.querySelector('[data-field="gallery"]') as HTMLDivElement | null;

  yearEl.textContent = projectData.year || '—';
  locationEl.textContent = projectData.location || '—';
  typeEl.textContent = projectData.type || '—';
  descEl.textContent = projectData.description;

  const images = isRightPanel ? projectData.rightPanelImages : projectData.leftPanelImages;

  if (galleryEl) {
    galleryEl.replaceChildren(
      ...(images || []).map((data, i) => {
        const img = document.createElement('img');
        img.sizes = data.sizes;
        img.srcset = data.srcset;
        img.src = data.src;
        img.alt = data.alt;
        if (data.width && data.height) {
          img.width = data.width;
          img.height = data.height;
        }
        if (data.thumbhash) {
          img.dataset.thumbhash = data.thumbhash;
          img.style.cssText = data.placeholderStyle;
        }
        // The first screenful is usually already warmed by preloader.ts; load
        // it eagerly so it paints as the panel slides in, not after.
        img.loading = i < 4 ? 'eager' : 'lazy';
        applyPlaceholder(img);
        return img;
      })
    );
  }
}

function openProject(card: HTMLElement) {
  const isLeftColumn = card.closest('.gallery-column--left') !== null;
  const isRightColumn = card.closest('.gallery-column--right') !== null;

  // Only handle desktop columns
  if (!isLeftColumn && !isRightColumn) return;

  const projectData = getProjectData(card.dataset.projectId || '');
  if (!projectData) return;

  if (isLeftColumn) {
    populatePanel(leftPanel, projectData, false);
    mainGallery.classList.add('project-open-left');
  } else if (isRightColumn) {
    populatePanel(rightPanel, projectData, true);
    mainGallery.classList.add('project-open-right');
  }
}

function closeProject() {
  mainGallery.classList.remove('project-open-left', 'project-open-right');
}

function isProjectOpen(): boolean {
  return mainGallery.classList.contains('project-open-left') ||
         mainGallery.classList.contains('project-open-right');
}

// Event delegation for project cards and columns
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  // If project is open, clicking on either column closes it
  if (isProjectOpen()) {
    const isInColumn = target.closest('.gallery-column-container--col1') ||
                       target.closest('.gallery-column-container--col4');
    if (isInColumn) {
      closeProject();
      return;
    }
  }

  // Otherwise, clicking a card opens the project
  const card = target.closest('.project-card');
  if (card) {
    openProject(card as HTMLElement);
    return;
  }
});

// Escape key to close project (only if lightbox is not open)
document.addEventListener('keydown', (e) => {
  const lightboxEl = document.getElementById('lightbox');
  if (e.key === 'Escape' && isProjectOpen() && !lightboxEl?.classList.contains('open')) {
    closeProject();
  }
});

// Update scroll indicators on mobile
function setupScrollIndicators() {
  const rows = document.querySelectorAll('.gallery-row');

  rows.forEach(row => {
    const galleryId = row.getAttribute('data-gallery-id');
    const indicators = document.querySelector(`.scroll-indicators[data-gallery-id="${galleryId}"]`);
    if (!indicators) return;

    const dots = indicators.querySelectorAll('.scroll-indicators__dot');
    const cards = row.querySelectorAll('.project-card');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = Array.from(cards).indexOf(entry.target as Element);
          dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
          });
        }
      });
    }, {
      root: row as Element,
      threshold: 0.5
    });

    cards.forEach(card => observer.observe(card));
  });
}

setupScrollIndicators();

// ===========================================
// LIGHTBOX FUNCTIONALITY
// ===========================================

const lightbox = document.getElementById('lightbox') as HTMLDivElement;
const lightboxImage = lightbox?.querySelector('.lightbox__image') as HTMLImageElement;
const lightboxLoader = lightbox?.querySelector('.lightbox__loader') as HTMLDivElement;
const lightboxClose = lightbox?.querySelector('.lightbox__close') as HTMLButtonElement;
const lightboxPrev = lightbox?.querySelector('.lightbox__nav--prev') as HTMLButtonElement;
const lightboxNext = lightbox?.querySelector('.lightbox__nav--next') as HTMLButtonElement;

// State for gallery navigation
let currentGalleryImages: HTMLImageElement[] = [];
let currentImageIndex = 0;

// Swap a rendered image URL for its full-size, high-quality version.
// URL format: <media base>/img/{id}/{width}-{ratio}-{fit}-q{quality}.webp
function getLightboxUrl(originalSrc: string): string {
  // Keep the ?v= cache-busting token, which identifies the stored original.
  const match = originalSrc.match(/^(.*\/img\/[^/]+)\/[^/?]+(\?.*)?$/);
  if (!match) return originalSrc;

  return `${match[1]}/2560-orig-scale-down-q90.webp${match[2] || ''}`;
}

function updateNavVisibility() {
  if (!lightboxPrev || !lightboxNext) return;

  // Hide prev at first image, hide next at last image
  lightboxPrev.classList.toggle('hidden', currentImageIndex === 0);
  lightboxNext.classList.toggle('hidden', currentImageIndex >= currentGalleryImages.length - 1);
}

// Full-size files are 0.5–1.7 MB and rendered on demand the first time, so
// fetch them before they are asked for: on hover, and the neighbours of the
// image being viewed. Held until loaded so the request isn't dropped.
const warming = new Map<string, HTMLImageElement>();
const warmed = new Set<string>();

function warmLightbox(img: HTMLImageElement | undefined) {
  if (!img) return;
  const url = getLightboxUrl(img.src || img.currentSrc);
  if (warmed.has(url)) return;
  warmed.add(url);
  const el = new Image();
  el.onload = el.onerror = () => warming.delete(url);
  warming.set(url, el);
  el.src = url;
}

const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
let showToken = 0;
let spinnerTimer: ReturnType<typeof setTimeout> | undefined;

// Give the lightbox image the box the full-size file will have (2560px
// scale-down, fitted to the viewport), so the ThumbHash placeholder and the
// sharp file occupy exactly the same space. Without dimensions, CSS sizes it.
function sizeLightboxImage(source: HTMLImageElement) {
  const container = lightboxImage.parentElement;
  const w0 = Number(source.getAttribute('width')) || 0;
  const h0 = Number(source.getAttribute('height')) || 0;
  if (!container || !w0 || !h0) {
    lightboxImage.style.width = '';
    lightboxImage.style.height = '';
    return;
  }
  const w = Math.min(2560, w0);
  const h = (w * h0) / w0;
  const cs = getComputedStyle(container);
  const boxW = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const boxH = container.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const scale = Math.min(1, boxW / w, boxH / h);
  lightboxImage.style.width = `${Math.round(w * scale)}px`;
  lightboxImage.style.height = `${Math.round(h * scale)}px`;
}

function showImage(index: number) {
  if (!lightboxImage || index < 0 || index >= currentGalleryImages.length) return;

  const token = ++showToken;
  currentImageIndex = index;
  const imgElement = currentGalleryImages[index];
  const highQualitySrc = getLightboxUrl(imgElement.src || imgElement.currentSrc);

  clearTimeout(spinnerTimer);
  lightboxLoader?.classList.remove('visible');
  lightboxImage.alt = imgElement.alt || '';
  sizeLightboxImage(imgElement);
  lightboxImage.classList.add('loaded');

  const full = new Image();
  full.src = highQualitySrc;

  const showFull = () => {
    lightboxImage.src = highQualitySrc;
    lightboxImage.style.backgroundImage = '';
    lightboxImage.style.backgroundColor = '';
  };
  const warmNeighbours = () => {
    warmLightbox(currentGalleryImages[index + 1]);
    warmLightbox(currentGalleryImages[index - 1]);
  };

  // Already warmed (hover, or a neighbour): show it straight away
  if (full.complete && full.naturalWidth > 0) {
    showFull();
    warmNeighbours();
    updateNavVisibility();
    return;
  }

  // Otherwise the image's ThumbHash fills the final box until the file is in.
  // Spinner only when there is no ThumbHash and the wait is noticeable.
  const hash = imgElement.dataset.thumbhash;
  const placeholder = hash ? decodeThumbHash(hash) : null;
  lightboxImage.src = BLANK_PIXEL;
  lightboxImage.style.backgroundImage = placeholder ? `url(${placeholder})` : '';
  lightboxImage.style.backgroundColor = imgElement.style.backgroundColor;
  lightboxImage.style.backgroundSize = '100% 100%';
  if (!placeholder) {
    spinnerTimer = setTimeout(() => lightboxLoader?.classList.add('visible'), 300);
  }

  full.decode().catch(() => {}).then(() => {
    if (token !== showToken) return;
    clearTimeout(spinnerTimer);
    lightboxLoader?.classList.remove('visible');
    if (full.naturalWidth > 0) showFull();
    warmNeighbours();
  });

  updateNavVisibility();
}

function navigatePrev() {
  if (currentImageIndex > 0) {
    showImage(currentImageIndex - 1);
  }
}

function navigateNext() {
  if (currentImageIndex < currentGalleryImages.length - 1) {
    showImage(currentImageIndex + 1);
  }
}

function openLightbox(imgElement: HTMLImageElement) {
  if (!lightbox || !lightboxImage) return;

  // Find the gallery container and get all images
  const gallery = imgElement.closest('.project-page__gallery, .project-card__expanded-gallery');
  if (gallery) {
    currentGalleryImages = Array.from(gallery.querySelectorAll('img')) as HTMLImageElement[];
    currentImageIndex = currentGalleryImages.indexOf(imgElement);
  } else {
    // Single image, no gallery
    currentGalleryImages = [imgElement];
    currentImageIndex = 0;
  }

  showImage(currentImageIndex);

  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  if (!lightbox) return;

  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  // Clear state after transition
  setTimeout(() => {
    if (lightboxImage) {
      lightboxImage.src = '';
      lightboxImage.removeAttribute('style');
      lightboxImage.classList.remove('loaded');
    }
    clearTimeout(spinnerTimer);
    lightboxLoader?.classList.remove('visible');
    currentGalleryImages = [];
    currentImageIndex = 0;
  }, 300);
}

// Event listeners for lightbox
if (lightbox) {
  // Click on gallery images (desktop only)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Check if clicked on a gallery image (skip lightbox on mobile)
    const galleryImage = target.closest('.project-page__gallery img, .project-card__expanded-gallery img');
    if (galleryImage && galleryImage instanceof HTMLImageElement) {
      // Don't open lightbox on mobile devices
      if (window.innerWidth < 768) return;

      e.preventDefault();
      e.stopPropagation();
      openLightbox(galleryImage);
      return;
    }
  });

  // Warm the full-size file while the pointer is on a gallery image
  document.addEventListener('pointerover', (e) => {
    const img = (e.target as Element | null)?.closest?.('.project-page__gallery img');
    if (img instanceof HTMLImageElement && window.innerWidth >= 768) warmLightbox(img);
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (lightbox.classList.contains('open')) sizeLightboxImage(currentGalleryImages[currentImageIndex]);
  });

  // Navigation buttons
  lightboxPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    navigatePrev();
  });

  lightboxNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateNext();
  });

  // Close button
  lightboxClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeLightbox();
  });

  // Click on backdrop (outside image)
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || (e.target as HTMLElement).classList.contains('lightbox__content')) {
      closeLightbox();
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;

    switch (e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        navigatePrev();
        break;
      case 'ArrowRight':
        navigateNext();
        break;
    }
  });
}
