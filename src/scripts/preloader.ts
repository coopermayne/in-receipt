// Image preloading with Intersection Observer
interface ProjectData {
  images?: string[];
  year?: string;
  location?: string;
  type?: string;
}

function preloadImage(src: string): void {
  const img = new Image();
  img.src = src;
}

function getProjectImages(card: HTMLElement): string[] {
  try {
    const projectData: ProjectData = JSON.parse(card.dataset.projectData || '{}');
    return projectData.images || [];
  } catch {
    return [];
  }
}

function setupCardFadeIn() {
  const cardInners = document.querySelectorAll('.gallery-column .project-card__inner');

  cardInners.forEach(inner => {
    const img = inner.querySelector('.project-card__image') as HTMLImageElement;
    if (!img) return;

    if (img.complete && img.naturalHeight !== 0) {
      // Image already loaded
      inner.classList.add('loaded');
    } else {
      // Wait for image to load
      img.addEventListener('load', () => {
        inner.classList.add('loaded');
      });
      // Handle error case - still show content
      img.addEventListener('error', () => {
        inner.classList.add('loaded');
      });
    }
  });
}

function setupPreloader() {
  const cards = document.querySelectorAll('.project-card');

  // Preload all project images immediately on page load
  cards.forEach(card => {
    const images = getProjectImages(card as HTMLElement);
    images.forEach(src => preloadImage(src));
  });

  // Setup fade-in for card content when thumbnail loads
  setupCardFadeIn();
}

setupPreloader();
