// Mobile project transition - instant expand
// Content is preloaded in cards, just show/hide on click
// Original title stays in place (no cloning = no flicker)

function isMobile(): boolean {
  return window.innerWidth < 768;
}

let activeCard: HTMLElement | null = null;
let savedScrollPositions: number[] = [];
let overlayHost: HTMLElement | null = null;
let moved: { el: HTMLElement; parent: Node; next: Node | null }[] = [];

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

    // Determine which row (big = upper, small = lower)
    const rowContainer = card.closest('.gallery-row-container') as HTMLElement;
    const isUpperRow = rowContainer?.getAttribute('data-category') === 'big';

    // Move the overlay and title out of the scrolling row into a fixed host
    // on <body>. iOS Safari clips fixed elements to an overflow scroller, so
    // left inside the row the overlay only covered that row's half.
    const expandedEl = card.querySelector('.project-card__expanded') as HTMLElement | null;
    const contentEl = card.querySelector('.project-card__content') as HTMLElement | null;
    const host = document.createElement('div');
    host.className = `mobile-project-overlay ${isUpperRow ? 'expanded--upper' : 'expanded--lower'}`;
    host.dataset.category = isUpperRow ? 'big' : 'small';

    // Fix the title in its current viewport position so it doesn't move
    if (contentEl) {
      const contentRect = contentEl.getBoundingClientRect();
      contentEl.style.position = 'fixed';
      contentEl.style.top = `${contentRect.top}px`;
      contentEl.style.left = `${contentRect.left}px`;
      contentEl.style.zIndex = '150';
      // Expanded content starts below the title
      host.style.setProperty('--title-bottom', `${contentRect.bottom}px`);
    }
    moved = [];
    [expandedEl, contentEl].forEach((el) => {
      if (!el) return;
      moved.push({ el, parent: el.parentNode as Node, next: el.nextSibling });
      host.appendChild(el);
    });
    document.body.appendChild(host);
    overlayHost = host;

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

    // Put the overlay and title back in the card
    moved.forEach(({ el, parent, next }) => parent.insertBefore(el, next));
    moved = [];
    overlayHost?.remove();
    overlayHost = null;

    // Reset title positioning
    const contentEl = activeCard.querySelector('.project-card__content') as HTMLElement;
    if (contentEl) {
      contentEl.style.position = '';
      contentEl.style.top = '';
      contentEl.style.left = '';
      contentEl.style.zIndex = '';
    }

    activeCard.classList.remove('expanded');
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
