// Sliding panel logic for desktop project pages
const mainGallery = document.querySelector('.main-gallery') as HTMLElement;
const leftPanel = document.getElementById('project-page-left') as HTMLDivElement;
const rightPanel = document.getElementById('project-page-right') as HTMLDivElement;

interface ProjectData {
  images: string[];
  year?: string;
  location?: string;
  type?: string;
}

function populatePanel(panel: HTMLDivElement, description: string, projectData: ProjectData) {
  const yearEl = panel.querySelector('[data-field="year"]') as HTMLSpanElement;
  const locationEl = panel.querySelector('[data-field="location"]') as HTMLSpanElement;
  const typeEl = panel.querySelector('[data-field="type"]') as HTMLSpanElement;
  const descEl = panel.querySelector('[data-field="description"]') as HTMLParagraphElement;
  const galleryEl = panel.querySelector('[data-field="gallery"]') as HTMLDivElement | null;
  const featuredImageEl = panel.querySelector('[data-field="featured-image"]') as HTMLDivElement | null;

  yearEl.textContent = projectData.year || '—';
  locationEl.textContent = projectData.location || '—';
  typeEl.textContent = projectData.type || '—';
  descEl.textContent = description;

  // Left panel uses gallery, right panel uses single featured image
  if (galleryEl) {
    galleryEl.innerHTML = (projectData.images || [])
      .map(src => `<img src="${src}" alt="Project image" loading="lazy" />`)
      .join('');
  }

  if (featuredImageEl) {
    const firstImage = projectData.images?.[0];
    featuredImageEl.innerHTML = firstImage
      ? `<img src="${firstImage}" alt="Project image" loading="lazy" />`
      : '';
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
    populatePanel(leftPanel, description, projectData);
    mainGallery.classList.add('project-open-left');
  } else if (isRightColumn) {
    populatePanel(rightPanel, description, projectData);
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

// Escape key to close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isProjectOpen()) {
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
