// Sliding panel logic for desktop project pages
const mainGallery = document.querySelector('.main-gallery') as HTMLElement;
const leftPanel = document.getElementById('project-page-left') as HTMLDivElement;
const rightPanel = document.getElementById('project-page-right') as HTMLDivElement;

interface ResponsiveImage {
  id: string;
  src: string;
  srcset: string;
  sizes: string;
  focalPoint: string;
  alt: string;
}

interface ProjectData {
  leftPanelImages: ResponsiveImage[];
  rightPanelImages: ResponsiveImage[];
  year?: string;
  location?: string;
  type?: string;
}

function populatePanel(panel: HTMLDivElement, description: string, projectData: ProjectData, isRightPanel: boolean = false) {
  const yearEl = panel.querySelector('[data-field="year"]') as HTMLSpanElement;
  const locationEl = panel.querySelector('[data-field="location"]') as HTMLSpanElement;
  const typeEl = panel.querySelector('[data-field="type"]') as HTMLSpanElement;
  const descEl = panel.querySelector('[data-field="description"]') as HTMLParagraphElement;
  const galleryEl = panel.querySelector('[data-field="gallery"]') as HTMLDivElement | null;

  yearEl.textContent = projectData.year || '—';
  locationEl.textContent = projectData.location || '—';
  typeEl.textContent = projectData.type || '—';
  descEl.textContent = description;

  const images = isRightPanel ? projectData.rightPanelImages : projectData.leftPanelImages;

  if (galleryEl) {
    galleryEl.innerHTML = (images || [])
      .map(img => `<img
        src="${img.src}"
        srcset="${img.srcset}"
        sizes="${img.sizes}"
        alt="${img.alt}"
        loading="lazy"
        style="object-position: ${img.focalPoint};"
      />`)
      .join('');
  }
}

function openProject(card: HTMLElement) {
  const isLeftColumn = card.closest('.gallery-column--left') !== null;
  const isRightColumn = card.closest('.gallery-column--right') !== null;

  // Only handle desktop columns
  if (!isLeftColumn && !isRightColumn) return;

  // Get project data
  const description = card.dataset.projectDescription || '';
  const projectData: ProjectData = JSON.parse(card.dataset.projectData || '{}');

  if (isLeftColumn) {
    populatePanel(leftPanel, description, projectData, false);
    mainGallery.classList.add('project-open-left');
  } else if (isRightColumn) {
    populatePanel(rightPanel, description, projectData, true);
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

// Extract Cloudflare image ID from URL and create high-quality version
function getLightboxUrl(originalSrc: string): string {
  // URL format: https://imagedelivery.net/{accountHash}/{cloudflareId}/{variant}
  const match = originalSrc.match(/imagedelivery\.net\/([^/]+)\/([^/]+)\//);
  if (!match) return originalSrc;

  const [, accountHash, cloudflareId] = match;
  // Create high-quality full-size version
  return `https://imagedelivery.net/${accountHash}/${cloudflareId}/w=2560,q=90,f=auto`;
}

function updateNavVisibility() {
  if (!lightboxPrev || !lightboxNext) return;

  // Hide prev at first image, hide next at last image
  lightboxPrev.classList.toggle('hidden', currentImageIndex === 0);
  lightboxNext.classList.toggle('hidden', currentImageIndex >= currentGalleryImages.length - 1);
}

function showImage(index: number) {
  if (!lightboxImage || index < 0 || index >= currentGalleryImages.length) return;

  currentImageIndex = index;
  const imgElement = currentGalleryImages[index];
  const thumbnailSrc = imgElement.src || imgElement.currentSrc;
  const highQualitySrc = getLightboxUrl(thumbnailSrc);
  const alt = imgElement.alt || '';

  // Reset state and show loader
  lightboxImage.classList.remove('loaded');
  lightboxLoader?.classList.add('visible');

  // Load high-quality version
  lightboxImage.alt = alt;
  lightboxImage.onload = () => {
    lightboxLoader?.classList.remove('visible');
    lightboxImage.classList.add('loaded');
  };
  lightboxImage.src = highQualitySrc;

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
      lightboxImage.classList.remove('loaded');
    }
    lightboxLoader?.classList.remove('visible');
    currentGalleryImages = [];
    currentImageIndex = 0;
  }, 300);
}

// Event listeners for lightbox
if (lightbox) {
  // Click on gallery images (desktop left panel and mobile expanded)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Check if clicked on a gallery image
    const galleryImage = target.closest('.project-page__gallery img, .project-card__expanded-gallery img');
    if (galleryImage && galleryImage instanceof HTMLImageElement) {
      e.preventDefault();
      e.stopPropagation();
      openLightbox(galleryImage);
      return;
    }
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
