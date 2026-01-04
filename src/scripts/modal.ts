// Modal FLIP animation logic
const modal = document.getElementById('project-modal') as HTMLDivElement;
const modalHero = document.getElementById('modal-hero') as HTMLImageElement;
const modalTitle = document.getElementById('modal-title') as HTMLHeadingElement;
const modalDescription = document.getElementById('modal-description') as HTMLParagraphElement;
const modalGallery = document.getElementById('modal-gallery') as HTMLDivElement;
const closeBtn = modal.querySelector('.modal-close') as HTMLButtonElement;

let currentSourceImage: HTMLImageElement | null = null;
let flipImage: HTMLImageElement | null = null;

function openModal(card: HTMLElement) {
  const projectId = card.dataset.projectId;
  const title = card.dataset.projectTitle || '';
  const description = card.dataset.projectDescription || '';
  const images: string[] = JSON.parse(card.dataset.projectImages || '[]');
  const sourceImg = card.querySelector('.project-card__image') as HTMLImageElement;

  if (!sourceImg) return;

  currentSourceImage = sourceImg;

  // Get source rect
  const sourceRect = sourceImg.getBoundingClientRect();

  // Set modal content
  modalTitle.textContent = title;
  modalDescription.textContent = description;
  modalHero.src = sourceImg.src;
  modalHero.alt = title;

  // Populate gallery
  modalGallery.innerHTML = images
    .map(src => `<img class="modal-gallery__image" src="${src}" alt="${title}" loading="lazy" />`)
    .join('');

  // Create FLIP image clone
  flipImage = document.createElement('img');
  flipImage.src = sourceImg.src;
  flipImage.className = 'flip-image';
  flipImage.style.left = `${sourceRect.left}px`;
  flipImage.style.top = `${sourceRect.top}px`;
  flipImage.style.width = `${sourceRect.width}px`;
  flipImage.style.height = `${sourceRect.height}px`;
  document.body.appendChild(flipImage);

  // Open modal (content fades in via CSS)
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Calculate target position (hero image area)
  requestAnimationFrame(() => {
    const targetRect = modalHero.getBoundingClientRect();

    // FLIP: calculate transform
    const scaleX = targetRect.width / sourceRect.width;
    const scaleY = targetRect.height / sourceRect.height;
    const translateX = targetRect.left - sourceRect.left;
    const translateY = targetRect.top - sourceRect.top;

    if (flipImage) {
      flipImage.style.transition = 'transform 350ms cubic-bezier(0.4, 0, 0.2, 1)';
      flipImage.style.transformOrigin = 'top left';
      flipImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
    }

    // Remove flip image after animation
    setTimeout(() => {
      if (flipImage) {
        flipImage.remove();
        flipImage = null;
      }
    }, 350);
  });
}

function closeModal() {
  if (!currentSourceImage) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    return;
  }

  const sourceRect = currentSourceImage.getBoundingClientRect();
  const heroRect = modalHero.getBoundingClientRect();

  // Create FLIP image for close animation
  flipImage = document.createElement('img');
  flipImage.src = modalHero.src;
  flipImage.className = 'flip-image';
  flipImage.style.left = `${heroRect.left}px`;
  flipImage.style.top = `${heroRect.top}px`;
  flipImage.style.width = `${heroRect.width}px`;
  flipImage.style.height = `${heroRect.height}px`;
  document.body.appendChild(flipImage);

  // Start closing modal (fade out content)
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');

  // FLIP: animate back to source
  requestAnimationFrame(() => {
    const scaleX = sourceRect.width / heroRect.width;
    const scaleY = sourceRect.height / heroRect.height;
    const translateX = sourceRect.left - heroRect.left;
    const translateY = sourceRect.top - heroRect.top;

    if (flipImage) {
      flipImage.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)';
      flipImage.style.transformOrigin = 'top left';
      flipImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
    }

    setTimeout(() => {
      if (flipImage) {
        flipImage.remove();
        flipImage = null;
      }
      document.body.style.overflow = '';
      currentSourceImage = null;
    }, 300);
  });
}

// Event delegation for project cards
document.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.project-card');
  if (card) {
    openModal(card as HTMLElement);
    return;
  }

  // Close on backdrop click (above hero)
  if (e.target === modal) {
    closeModal();
  }
});

// Close button
closeBtn.addEventListener('click', closeModal);

// Escape key to close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) {
    closeModal();
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
