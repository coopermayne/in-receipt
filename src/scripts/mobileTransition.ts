// Mobile project transition animation
// 1. White circle expands from orange button position
// 2. Project title stays exactly where it is
// 3. Project content fades in around the title

function isMobile(): boolean {
  return window.innerWidth < 768;
}

let floatingTitle: HTMLElement | null = null;

function setupMobileTransition() {
  const overlay = document.querySelector('.mobile-project-overlay');
  const infoBtn = document.querySelector('.mobile-info-btn');
  const modal = document.getElementById('project-modal');
  const modalClose = modal?.querySelector('.modal-close');

  // Modal content elements
  const modalYear = document.getElementById('modal-year');
  const modalLocation = document.getElementById('modal-location');
  const modalType = document.getElementById('modal-type');
  const modalDescription = document.getElementById('modal-description');
  const modalGallery = document.getElementById('modal-gallery');

  if (!overlay || !modal) return;

  // Handle project card clicks on mobile
  document.addEventListener('click', (e) => {
    if (!isMobile()) return;

    const target = e.target as HTMLElement;
    const card = target.closest('.project-card') as HTMLElement;
    const isInGalleryRow = target.closest('.gallery-row');

    if (!card || !isInGalleryRow) return;

    e.preventDefault();
    e.stopPropagation();

    // Get project data
    const title = card.getAttribute('data-project-title') || '';
    const description = card.getAttribute('data-project-description') || '';
    const projectDataStr = card.getAttribute('data-project-data') || '{}';
    const projectData = JSON.parse(projectDataStr);

    // Determine which row (residential = upper, commercial = lower)
    const rowContainer = card.closest('.gallery-row-container') as HTMLElement;
    const isUpperRow = rowContainer?.getAttribute('data-category') === 'residential';

    // Get the title element and fix it in place
    const titleEl = card.querySelector('.project-card__title') as HTMLElement;
    const contentEl = card.querySelector('.project-card__content') as HTMLElement;
    let titleBottom = 0;

    if (titleEl && contentEl) {
      const contentRect = contentEl.getBoundingClientRect();
      titleBottom = contentRect.bottom;

      // Clone the entire content element (includes the ::before pseudo-element styling context)
      floatingTitle = contentEl.cloneNode(true) as HTMLElement;
      floatingTitle.className = 'mobile-floating-title';
      floatingTitle.style.top = `${contentRect.top}px`;
      floatingTitle.style.left = `${contentRect.left}px`;
      floatingTitle.style.right = 'auto';
      floatingTitle.style.bottom = 'auto';

      if (isUpperRow) {
        floatingTitle.classList.add('mobile-floating-title--upper');
      } else {
        floatingTitle.classList.add('mobile-floating-title--lower');
      }

      document.body.appendChild(floatingTitle);
    }

    // Add class to modal for positioning based on row
    modal.classList.remove('modal--upper', 'modal--lower');
    modal.classList.add(isUpperRow ? 'modal--upper' : 'modal--lower');

    // Store title bottom position for content placement
    if (isUpperRow) {
      modal.style.setProperty('--title-bottom', `${titleBottom}px`);
    }

    // Hide info button
    infoBtn?.classList.add('hidden');

    // White circle expands
    overlay.classList.add('active');

    // After white expands, show modal content
    setTimeout(() => {
      // Populate modal content
      if (modalYear) modalYear.textContent = projectData.year || '—';
      if (modalLocation) modalLocation.textContent = projectData.location || '—';
      if (modalType) modalType.textContent = projectData.type || '—';
      if (modalDescription) modalDescription.textContent = description;
      if (modalGallery) {
        modalGallery.innerHTML = (projectData.images || [])
          .map((src: string) => `<img src="${src}" alt="Project image" loading="lazy" />`)
          .join('');
      }

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }, 800);
  });

  // Close modal
  function closeModal() {
    if (!isMobile()) return;

    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');

    // Reset transition elements
    overlay.classList.remove('active');
    infoBtn?.classList.remove('hidden');
    modal.classList.remove('modal--upper', 'modal--lower');
    modal.style.removeProperty('--title-bottom');

    // Remove floating title
    if (floatingTitle) {
      floatingTitle.remove();
      floatingTitle = null;
    }
  }

  modalClose?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMobileTransition);
} else {
  setupMobileTransition();
}
