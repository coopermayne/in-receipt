// Sliding panel logic
const mainGallery = document.querySelector('.main-gallery') as HTMLElement;
const projectPanel = document.getElementById('project-panel') as HTMLDivElement;
const panelCloseBtn = projectPanel?.querySelector('.project-panel__close') as HTMLButtonElement;
const panelYear = document.getElementById('panel-year') as HTMLSpanElement;
const panelLocation = document.getElementById('panel-location') as HTMLSpanElement;
const panelType = document.getElementById('panel-type') as HTMLSpanElement;
const panelDescription = document.getElementById('panel-description') as HTMLParagraphElement;
const panelGallery = document.getElementById('panel-gallery') as HTMLDivElement;

interface ProjectData {
  images: string[];
  year?: string;
  location?: string;
  type?: string;
}

function openProject(card: HTMLElement) {
  // Determine which column the card is in
  const isLeftColumn = card.closest('.gallery-column--left') !== null;

  // Only handle left column for now
  if (!isLeftColumn) return;

  // Get project data
  const description = card.dataset.projectDescription || '';
  const projectData: ProjectData = JSON.parse(card.dataset.projectData || '{}');

  // Populate panel content
  panelYear.textContent = projectData.year || '—';
  panelLocation.textContent = projectData.location || '—';
  panelType.textContent = projectData.type || '—';
  panelDescription.textContent = description;
  panelGallery.innerHTML = (projectData.images || [])
    .map(src => `<img src="${src}" alt="Project image" loading="lazy" />`)
    .join('');

  // Slide the gallery left (pushes contact off, columns shift left)
  // Panel appears and slides with everything
  mainGallery.classList.add('project-open-left');
}

function closeProject() {
  // Slide gallery back
  mainGallery.classList.remove('project-open-left');
}

// Close button
if (panelCloseBtn) {
  panelCloseBtn.addEventListener('click', closeProject);
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
  if (e.key === 'Escape' && mainGallery.classList.contains('project-open-left')) {
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
