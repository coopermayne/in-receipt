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

function setupPreloader() {
  const cards = document.querySelectorAll('.project-card');

  // Preload all project images immediately on page load
  cards.forEach(card => {
    const images = getProjectImages(card as HTMLElement);
    images.forEach(src => preloadImage(src));
  });
}

setupPreloader();
