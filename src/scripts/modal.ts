// Sliding panel logic for desktop project detail
const mainGallery = document.querySelector('.main-gallery') as HTMLElement;
const leftPanel = document.getElementById('project-detail-left') as HTMLDivElement;
const rightPanel = document.getElementById('project-detail-right') as HTMLDivElement;

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
  const galleryEl = panel.querySelector('[data-field="gallery"]') as HTMLDivElement;

  yearEl.textContent = projectData.year || '—';
  locationEl.textContent = projectData.location || '—';
  typeEl.textContent = projectData.type || '—';
  descEl.textContent = description;
  galleryEl.innerHTML = (projectData.images || [])
    .map(src => `<img src="${src}" alt="Project image" loading="lazy" />`)
    .join('');
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

// Event delegation for project cards
document.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.project-card');
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
