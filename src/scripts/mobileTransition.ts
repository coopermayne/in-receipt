// Mobile project transition - instant expand
// Content is preloaded in cards, just show/hide on click
// Original title stays in place (no cloning = no flicker)

function isMobile(): boolean {
  return window.innerWidth < 768;
}

let activeCard: HTMLElement | null = null;
let savedScrollPositions: number[] = [];

function setupMobileTransition() {
  const infoBtn = document.querySelector('.mobile-info-btn');

  // Handle project card clicks on mobile
  document.addEventListener('click', (e) => {
    if (!isMobile()) return;

    const target = e.target as HTMLElement;

    // Handle close button click
    if (target.closest('.project-card__close')) {
      e.preventDefault();
      e.stopPropagation();
      closeActiveCard();
      return;
    }

    const card = target.closest('.project-card') as HTMLElement;
    const isInGalleryRow = target.closest('.gallery-row');

    if (!card || !isInGalleryRow) return;

    e.preventDefault();
    e.stopPropagation();

    // Close any existing open card first
    if (activeCard && activeCard !== card) {
      closeActiveCard();
    }

    // Determine which row (residential = upper, commercial = lower)
    const rowContainer = card.closest('.gallery-row-container') as HTMLElement;
    const isUpperRow = rowContainer?.getAttribute('data-category') === 'residential';

    // Get title position and fix it in place
    const contentEl = card.querySelector('.project-card__content') as HTMLElement;

    if (contentEl) {
      const contentRect = contentEl.getBoundingClientRect();

      // Fix the original title in its current viewport position
      contentEl.style.position = 'fixed';
      contentEl.style.top = `${contentRect.top}px`;
      contentEl.style.left = `${contentRect.left}px`;
      contentEl.style.zIndex = '150';

      // Store bottom position for content layout
      card.style.setProperty('--title-bottom', `${contentRect.bottom}px`);
    }

    // Add position class
    card.classList.remove('expanded--upper', 'expanded--lower');
    card.classList.add(isUpperRow ? 'expanded--upper' : 'expanded--lower');

    // Expand the card
    card.classList.add('expanded');
    activeCard = card;

    // Hide info button
    infoBtn?.classList.add('hidden');

    // Save scroll positions before opening (values only, ViewTransitions replaces DOM)
    savedScrollPositions = [];
    document.querySelectorAll('.gallery-row').forEach((row) => {
      savedScrollPositions.push(row.scrollLeft);
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Push history state so back button closes the project
    history.pushState({ projectOpen: true }, '');
  });

  function closeActiveCard() {
    if (!activeCard) return;

    // Reset title positioning
    const contentEl = activeCard.querySelector('.project-card__content') as HTMLElement;
    if (contentEl) {
      contentEl.style.position = '';
      contentEl.style.top = '';
      contentEl.style.left = '';
      contentEl.style.zIndex = '';
    }

    activeCard.classList.remove('expanded', 'expanded--upper', 'expanded--lower');
    activeCard.style.removeProperty('--title-bottom');
    activeCard = null;

    // Show info button
    infoBtn?.classList.remove('hidden');

    // Restore body scroll
    document.body.style.overflow = '';
  }

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeCard) {
      closeActiveCard();
    }
  });

  // Close on browser back button
  window.addEventListener('popstate', () => {
    if (isMobile() && activeCard) {
      closeActiveCard();
      // Store scroll values for restoration after ViewTransitions completes
      (window as any).__pendingScrollRestore = [...savedScrollPositions];
    }
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMobileTransition);
} else {
  setupMobileTransition();
}

// Restore scroll after Astro ViewTransitions replaces DOM
document.addEventListener('astro:page-load', () => {
  const scrollValues = (window as any).__pendingScrollRestore;
  if (scrollValues && isMobile()) {
    const rows = document.querySelectorAll('.gallery-row');
    rows.forEach((row, i) => {
      const targetScroll = scrollValues[i] || 0;
      (row as HTMLElement).style.scrollSnapType = 'none';
      row.scrollLeft = targetScroll;
    });
    // Re-enable scroll snap after position is set
    setTimeout(() => {
      rows.forEach((row) => {
        (row as HTMLElement).style.scrollSnapType = '';
      });
    }, 50);
    (window as any).__pendingScrollRestore = null;
  }
});
