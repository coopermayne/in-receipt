// Custom smooth scroll with momentum for gallery columns
const SCROLL_DURATION = 1200; // ms - slower for more deliberate feel
const EASING = (t: number): number => {
  // Ease-out cubic for smooth deceleration
  return 1 - Math.pow(1 - t, 3);
};

interface ScrollState {
  isScrolling: boolean;
  currentIndex: number;
  startTime: number;
  startPosition: number;
  targetPosition: number;
}

function initSmoothScroll(column: HTMLElement) {
  const cards = column.querySelectorAll('.project-card');
  if (cards.length === 0) return;

  const state: ScrollState = {
    isScrolling: false,
    currentIndex: 0,
    startTime: 0,
    startPosition: 0,
    targetPosition: 0,
  };

  // Disable native scroll snap - we'll handle it
  column.style.scrollSnapType = 'none';

  function getCardHeight(): number {
    return window.innerHeight;
  }

  function scrollToIndex(index: number) {
    // Block input while animating - one at a time only
    if (state.isScrolling) return;

    const maxIndex = cards.length - 1;
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));

    if (clampedIndex === state.currentIndex) return;

    state.startPosition = column.scrollTop;
    state.targetPosition = clampedIndex * getCardHeight();
    state.startTime = performance.now();
    state.isScrolling = true;

    const targetIndex = clampedIndex;

    function animateScroll(currentTime: number) {
      const elapsed = currentTime - state.startTime;
      const progress = Math.min(elapsed / SCROLL_DURATION, 1);
      const easedProgress = EASING(progress);

      const newPosition = state.startPosition +
        (state.targetPosition - state.startPosition) * easedProgress;

      column.scrollTop = newPosition;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        state.isScrolling = false;
        state.currentIndex = targetIndex;
      }
    }

    requestAnimationFrame(animateScroll);
  }

  // Handle wheel events
  let wheelTimeout: number | null = null;
  let accumulatedDelta = 0;

  column.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Ignore wheel during animation
    if (state.isScrolling) return;

    accumulatedDelta += e.deltaY;

    if (wheelTimeout) {
      clearTimeout(wheelTimeout);
    }

    wheelTimeout = window.setTimeout(() => {
      const threshold = 50;
      if (Math.abs(accumulatedDelta) > threshold) {
        const direction = accumulatedDelta > 0 ? 1 : -1;
        scrollToIndex(state.currentIndex + direction);
      }
      accumulatedDelta = 0;
    }, 50);
  }, { passive: false });

  // Handle touch events
  let touchStartY = 0;

  column.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  column.addEventListener('touchend', (e) => {
    // Ignore touch during animation
    if (state.isScrolling) return;

    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY - touchEndY;
    const threshold = 30; // minimum swipe distance

    if (Math.abs(deltaY) > threshold) {
      const direction = deltaY > 0 ? 1 : -1;
      scrollToIndex(state.currentIndex + direction);
    }
  }, { passive: true });

  // Prevent default touch scroll
  column.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  // Handle keyboard navigation
  column.addEventListener('keydown', (e) => {
    if (state.isScrolling) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const direction = e.key === 'ArrowDown' ? 1 : -1;
      scrollToIndex(state.currentIndex + direction);
    }
  });

  // Make column focusable for keyboard nav
  column.tabIndex = 0;
}

// Initialize on desktop only
function init() {
  if (window.innerWidth >= 768) {
    const columns = document.querySelectorAll('.gallery-column');
    columns.forEach((column) => initSmoothScroll(column as HTMLElement));
  }
}

// Run after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
