// Image preloading with Intersection Observer
function preloadImage(src: string): void {
  const img = new Image();
  img.src = src;
}

function setupPreloader() {
  const cards = document.querySelectorAll('.project-card');

  // Preload adjacent images when card comes into view
  const preloadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target as HTMLElement;
        const images: string[] = JSON.parse(card.dataset.projectImages || '[]');

        // Preload project gallery images
        images.forEach(src => preloadImage(src));
      }
    });
  }, {
    rootMargin: '100px',
    threshold: 0
  });

  cards.forEach(card => preloadObserver.observe(card));

  // Desktop: preload on hover
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      const images: string[] = JSON.parse((card as HTMLElement).dataset.projectImages || '[]');
      images.forEach(src => preloadImage(src));
    }, { once: true });
  });
}

setupPreloader();
