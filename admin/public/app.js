// State
let images = {};
let currentFile = null;
let focalPoint = { x: 0.5, y: 0.5 };
let editingId = null;

// Elements
const imageGrid = document.getElementById('image-grid');
const uploadBtn = document.getElementById('upload-btn');
const uploadModal = document.getElementById('upload-modal');
const editModal = document.getElementById('edit-modal');
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const previewArea = document.getElementById('preview-area');
const previewImage = document.getElementById('preview-image');
const focalPointEl = document.getElementById('focal-point');
const focalDisplay = document.getElementById('focal-display');
const imageIdInput = document.getElementById('image-id');
const imageAltInput = document.getElementById('image-alt');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

// Edit modal elements
const editPreviewImage = document.getElementById('edit-preview-image');
const editFocalPointEl = document.getElementById('edit-focal-point');
const editFocalDisplay = document.getElementById('edit-focal-display');
const editImageIdInput = document.getElementById('edit-image-id');
const editImageAltInput = document.getElementById('edit-image-alt');
const updateBtn = document.getElementById('update-btn');
const deleteBtn = document.getElementById('delete-btn');
const editCancelBtn = document.getElementById('edit-cancel-btn');

// Initialize
async function init() {
  await loadImages();
  setupEventListeners();
}

// Load images from server
async function loadImages() {
  const res = await fetch('/api/images');
  images = await res.json();
  renderGrid();
}

// Render image grid
function renderGrid() {
  if (Object.keys(images).length === 0) {
    imageGrid.innerHTML = `
      <div class="empty-state">
        <p>No images yet. Click "Upload Image" to add your first image.</p>
      </div>
    `;
    return;
  }

  imageGrid.innerHTML = Object.entries(images).map(([id, img]) => `
    <div class="image-card" data-id="${id}">
      <img src="${getImageUrl(id)}" alt="${img.alt || ''}"
           style="object-position: ${img.focalPoint.x * 100}% ${img.focalPoint.y * 100}%">
      <div class="image-card-info">
        <div class="image-card-id">${id}</div>
        <div class="image-card-alt">${img.alt || 'No alt text'}</div>
      </div>
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.image-card').forEach(card => {
    card.addEventListener('click', () => openEditModal(card.dataset.id));
  });
}

// Build a media URL for an image id. The admin serves /img itself, so these
// are same-origin relative paths. The ?v= token busts the year-long cache
// when an image is replaced under an existing id.
function getImageUrl(id, width = 800) {
  const img = images[id];
  const version = img?.uploadedAt ? Date.parse(img.uploadedAt).toString(36) : '0';
  return `/img/${id}/${width}-orig-scale-down-q80.webp?v=${version}`;
}

// Setup event listeners
function setupEventListeners() {
  // Upload button
  uploadBtn.addEventListener('click', () => openUploadModal());

  // Close modals
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModals());
  });

  // Browse button
  browseBtn.addEventListener('click', () => fileInput.click());

  // File input
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Focal point click (upload modal)
  previewImage.parentElement.addEventListener('click', (e) => {
    if (e.target === previewImage) {
      setFocalPoint(e, previewImage, focalPointEl, focalDisplay);
    }
  });

  // Focal point click (edit modal)
  editPreviewImage.parentElement.addEventListener('click', (e) => {
    if (e.target === editPreviewImage) {
      setFocalPoint(e, editPreviewImage, editFocalPointEl, editFocalDisplay);
    }
  });

  // Form validation
  imageIdInput.addEventListener('input', validateForm);
  imageAltInput.addEventListener('input', validateForm);

  // Save button
  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', closeModals);

  // Edit modal buttons
  updateBtn.addEventListener('click', handleUpdate);
  deleteBtn.addEventListener('click', handleDelete);
  editCancelBtn.addEventListener('click', closeModals);

  // Close on backdrop click
  [uploadModal, editModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModals();
    });
  });
}

// Open upload modal
function openUploadModal() {
  resetUploadForm();
  uploadModal.classList.remove('hidden');
}

// Open edit modal
function openEditModal(id) {
  editingId = id;
  const img = images[id];

  editImageIdInput.value = id;
  editImageAltInput.value = img.alt || '';
  focalPoint = { ...img.focalPoint };

  const imageUrl = getImageUrl(id, 1200);
  editPreviewImage.src = imageUrl;
  updateFocalPointDisplay(editFocalPointEl, editFocalDisplay);
  updateCropPreviews(imageUrl, 'edit-');

  editModal.classList.remove('hidden');
}

// Close modals
function closeModals() {
  uploadModal.classList.add('hidden');
  editModal.classList.add('hidden');
  resetUploadForm();
}

// Reset upload form
function resetUploadForm() {
  currentFile = null;
  focalPoint = { x: 0.5, y: 0.5 };
  fileInput.value = '';
  imageIdInput.value = '';
  imageAltInput.value = '';
  previewArea.classList.add('hidden');
  uploadArea.classList.remove('hidden');
  saveBtn.disabled = true;
}

// Handle file selection
function handleFileSelect(e) {
  if (e.target.files.length) {
    handleFile(e.target.files[0]);
  }
}

// Handle file
function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  currentFile = file;

  // Generate suggested ID from filename
  const suggestedId = file.name
    .replace(/\.[^/.]+$/, '') // Remove extension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dashes
    .replace(/^-|-$/g, ''); // Remove leading/trailing dashes

  imageIdInput.value = suggestedId;

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    previewImage.onload = () => {
      uploadArea.classList.add('hidden');
      previewArea.classList.remove('hidden');
      focalPoint = { x: 0.5, y: 0.5 };
      updateFocalPointDisplay(focalPointEl, focalDisplay);
      updateCropPreviews(previewImage.src);
      validateForm();
    };
  };
  reader.readAsDataURL(file);
}

// Set focal point from click
function setFocalPoint(e, imgEl, focalEl, displayEl) {
  const rect = imgEl.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  focalPoint = {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y))
  };

  updateFocalPointDisplay(focalEl, displayEl);

  // Update crop previews with new focal point
  // Determine which modal we're in based on the image element
  const isEditModal = imgEl.id === 'edit-preview-image';
  const prefix = isEditModal ? 'edit-' : '';
  if (imgEl.src) {
    updateCropPreviews(imgEl.src, prefix);
  }
}

// Update focal point display
function updateFocalPointDisplay(focalEl, displayEl) {
  focalEl.style.left = `${focalPoint.x * 100}%`;
  focalEl.style.top = `${focalPoint.y * 100}%`;
  displayEl.textContent = `x: ${focalPoint.x.toFixed(2)}, y: ${focalPoint.y.toFixed(2)}`;
}

// Update crop preview thumbnails
function updateCropPreviews(imageSrc, prefix = '') {
  const cropImages = [
    document.getElementById(prefix + 'crop-portrait'),  // Mobile Residential (3:4)
    document.getElementById(prefix + 'crop-wide'),      // Mobile Commercial (16:9)
    document.getElementById(prefix + 'crop-square'),    // Desktop Commercial (1:1)
  ];

  cropImages.forEach(img => {
    if (img) {
      img.src = imageSrc;
      img.style.objectPosition = `${focalPoint.x * 100}% ${focalPoint.y * 100}%`;
    }
  });
}

// Validate form
function validateForm() {
  const id = imageIdInput.value.trim();
  const isValid = id && currentFile && !images[id];
  saveBtn.disabled = !isValid;

  // Show warning if ID exists
  if (images[id]) {
    imageIdInput.style.borderColor = '#dc3545';
  } else {
    imageIdInput.style.borderColor = '';
  }
}

// Handle save
async function handleSave() {
  if (!currentFile) return;

  saveBtn.disabled = true;
  saveBtn.textContent = 'Uploading...';

  try {
    // File and metadata go up together, so a failure can't leave a stored
    // file with no record of it (or the reverse).
    const id = imageIdInput.value.trim();

    const formData = new FormData();
    formData.append('image', currentFile);
    formData.append('data', JSON.stringify({
      focalPoint: { ...focalPoint },
      alt: imageAltInput.value.trim(),
      uploadedAt: new Date().toISOString()
    }));

    const saveRes = await fetch(`/api/images/${id}`, {
      method: 'POST',
      body: formData
    });

    if (!saveRes.ok) {
      const body = await saveRes.json().catch(() => ({}));
      throw new Error(body.error || 'Save failed');
    }

    // Reload and close
    await loadImages();
    markAsChanged();
    closeModals();
  } catch (error) {
    console.error('Error:', error);
    alert(`Failed to upload image: ${error.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Upload & Save';
  }
}

// Handle update
async function handleUpdate() {
  updateBtn.disabled = true;
  updateBtn.textContent = 'Saving...';

  try {
    const imageData = {
      ...images[editingId],
      focalPoint: { ...focalPoint },
      alt: editImageAltInput.value.trim()
    };

    const res = await fetch(`/api/images/${editingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageData)
    });

    if (!res.ok) {
      throw new Error('Update failed');
    }

    await loadImages();
    markAsChanged();
    closeModals();
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to update image. Please try again.');
  } finally {
    updateBtn.disabled = false;
    updateBtn.textContent = 'Save Changes';
  }
}

// Handle delete
async function handleDelete() {
  deleteBtn.disabled = true;
  deleteBtn.textContent = 'Deleting...';

  try {
    const res = await fetch(`/api/images/${editingId}`, {
      method: 'DELETE'
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.details
        ? `Failed to delete: ${JSON.stringify(data.details)}`
        : data.error || 'Delete failed';
      throw new Error(errorMsg);
    }

    await loadImages();
    markAsChanged();
    closeModals();
  } catch (error) {
    console.error('Error:', error);
    alert(error.message || 'Failed to delete image. Please try again.');
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = 'Delete';
  }
}

// ============ PROJECTS ============

// Projects State
let projects = [];
let editingProject = null;
let selectedProjectImages = [];
let projectThumbnail = null;
let projectsSortableBig = null;
let projectsSortableSmall = null;
let selectedImagesSortable = null;

// Projects Elements
const projectsListBig = document.getElementById('projects-list-big');
const projectsListSmall = document.getElementById('projects-list-small');
const newProjectBtn = document.getElementById('new-project-btn');
const projectModal = document.getElementById('project-modal');
const projectModalTitle = document.getElementById('project-modal-title');
const projectIdInput = document.getElementById('project-id');
const projectCategorySelect = document.getElementById('project-category');
const projectTitleInput = document.getElementById('project-title');
const projectYearInput = document.getElementById('project-year');
const projectLocationInput = document.getElementById('project-location');
const projectTypeInput = document.getElementById('project-type');
const projectShortDescInput = document.getElementById('project-short-desc');
const projectFullDescInput = document.getElementById('project-full-desc');
const selectedImagesEl = document.getElementById('selected-images');
const availableImagesEl = document.getElementById('available-images');
const projectSaveBtn = document.getElementById('project-save-btn');
const projectCancelBtn = document.getElementById('project-cancel-btn');
const deleteProjectBtn = document.getElementById('delete-project-btn');

// Tab Elements
const tabs = document.querySelectorAll('.tab');
const imagesSection = document.getElementById('images-section');
const projectsSection = document.getElementById('projects-section');
const profileSection = document.getElementById('profile-section');

// Tab Switching
function setupTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // Update tab buttons
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update sections
      imagesSection.classList.toggle('hidden', targetTab !== 'images');
      projectsSection.classList.toggle('hidden', targetTab !== 'projects');
      profileSection.classList.toggle('hidden', targetTab !== 'profile');
      if (targetTab === 'projects') loadProjects();
      if (targetTab === 'profile') loadProfile();
    });
  });
}

// Load projects from server
async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    projects = data.projects || [];
    renderProjectsList();
  } catch (error) {
    console.error('Failed to load projects:', error);
    projects = [];
    renderProjectsList();
  }
}

// Render projects list
function renderProjectsList() {
  const bigProjects = projects
    .filter(p => p.category === 'big')
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const smallProjects = projects
    .filter(p => p.category === 'small')
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

  // Render big projects column
  if (bigProjects.length === 0) {
    projectsListBig.innerHTML = `
      <div class="empty-state">
        <p>No big projects yet.</p>
      </div>
    `;
  } else {
    projectsListBig.innerHTML = bigProjects.map(project => renderProjectCard(project)).join('');
  }

  // Render small projects column
  if (smallProjects.length === 0) {
    projectsListSmall.innerHTML = `
      <div class="empty-state">
        <p>No little projects yet.</p>
      </div>
    `;
  } else {
    projectsListSmall.innerHTML = smallProjects.map(project => renderProjectCard(project)).join('');
  }

  // Add click handlers for editing
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't open modal if clicking drag handle
      if (e.target.closest('.project-drag-handle')) return;
      openProjectModal(card.dataset.id);
    });
  });

  // Initialize drag-and-drop for project reordering
  initProjectsSortable();
}

// Content problems that would break or degrade the published site
function getProjectWarnings(project) {
  const projectImages = project.images || [];
  if (projectImages.length === 0) {
    return ['This project has no images. It will appear empty on the site.'];
  }
  if (!project.thumbnail || !projectImages.includes(project.thumbnail)) {
    return ['This project has no starred image, so it has no thumbnail on the site. Open the project and click the star on one of its images.'];
  }
  return [];
}

// Render a single project card
function renderProjectCard(project) {
  const thumbnailUrl = images[project.thumbnail]
    ? getImageUrl(project.thumbnail, 400)
    : '';
  const warnings = getProjectWarnings(project);

  return `
    <div class="project-card${warnings.length ? ' has-warning' : ''}" data-id="${project.id}">
      <div class="project-drag-handle">⋮⋮</div>
      ${thumbnailUrl
        ? `<img class="project-thumbnail" src="${thumbnailUrl}" alt="${project.title}">`
        : `<div class="project-thumbnail"></div>`
      }
      <div class="project-info">
        <div class="project-title">${project.title}</div>
        <div class="project-meta">${project.location} · ${project.year}</div>
      </div>
      ${warnings.length
        ? `<div class="project-warning" title="${warnings.join(' ')}">i</div>`
        : ''
      }
    </div>
  `;
}

// Initialize Sortable for projects list
function initProjectsSortable() {
  if (projectsSortableBig) {
    projectsSortableBig.destroy();
  }
  if (projectsSortableSmall) {
    projectsSortableSmall.destroy();
  }

  // Only init if there are cards (not empty state)
  if (projectsListBig.querySelector('.project-card')) {
    projectsSortableBig = new Sortable(projectsListBig, {
      animation: 150,
      handle: '.project-drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: () => handleProjectReorder('big', projectsListBig)
    });
  }
  if (projectsListSmall.querySelector('.project-card')) {
    projectsSortableSmall = new Sortable(projectsListSmall, {
      animation: 150,
      handle: '.project-drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: () => handleProjectReorder('small', projectsListSmall)
    });
  }
}

// Handle project reorder for a specific category
async function handleProjectReorder(category, listElement) {
  const cards = listElement.querySelectorAll('.project-card');
  const projectIds = Array.from(cards).map(card => card.dataset.id);

  // Save new order to server
  try {
    await fetch('/api/projects/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, projectIds })
    });

    // Update local state ranks
    projectIds.forEach((id, index) => {
      const project = projects.find(p => p.id === id);
      if (project) {
        project.rank = index;
      }
    });
    markAsChanged();
  } catch (error) {
    console.error('Failed to reorder projects:', error);
    renderProjectsList(); // Revert on error
  }
}

// Open project modal
function openProjectModal(projectId = null) {
  editingProject = projectId ? projects.find(p => p.id === projectId) : null;

  if (editingProject) {
    projectModalTitle.textContent = 'Edit Project';
    projectIdInput.value = editingProject.id;
    projectIdInput.readOnly = true;
    projectCategorySelect.value = editingProject.category;
    projectTitleInput.value = editingProject.title;
    projectYearInput.value = editingProject.year || '';
    projectLocationInput.value = editingProject.location || '';
    projectTypeInput.value = editingProject.type || '';
    projectShortDescInput.value = editingProject.shortDescription || '';
    projectFullDescInput.value = editingProject.fullDescription || '';
    selectedProjectImages = [...(editingProject.images || [])];
    projectThumbnail = editingProject.thumbnail;
    deleteProjectBtn.style.display = 'block';
  } else {
    projectModalTitle.textContent = 'New Project';
    projectIdInput.value = '';
    projectIdInput.readOnly = false;
    projectCategorySelect.value = 'big';
    projectTitleInput.value = '';
    projectYearInput.value = new Date().getFullYear().toString();
    projectLocationInput.value = '';
    projectTypeInput.value = '';
    projectShortDescInput.value = '';
    projectFullDescInput.value = '';
    selectedProjectImages = [];
    projectThumbnail = null;
    deleteProjectBtn.style.display = 'none';
  }

  renderImagePicker();
  projectModal.classList.remove('hidden');
}

// Close project modal
function closeProjectModal() {
  projectModal.classList.add('hidden');
  editingProject = null;
  if (selectedImagesSortable) {
    selectedImagesSortable.destroy();
    selectedImagesSortable = null;
  }
}

// Render image picker
function renderImagePicker() {
  // Render selected images
  renderSelectedImages();

  // Render available images
  availableImagesEl.innerHTML = Object.entries(images).map(([id, img]) => {
    const isSelected = selectedProjectImages.includes(id);
    return `
      <div class="image-picker-item ${isSelected ? 'selected' : ''}" data-id="${id}">
        <img src="${getImageUrl(id, 400)}" alt="${img.alt || id}">
      </div>
    `;
  }).join('');

  // Add click handlers for available images
  availableImagesEl.querySelectorAll('.image-picker-item').forEach(item => {
    item.addEventListener('click', () => {
      const imageId = item.dataset.id;
      if (!selectedProjectImages.includes(imageId)) {
        selectedProjectImages.push(imageId);
        if (!projectThumbnail) {
          projectThumbnail = imageId;
        }
        renderImagePicker();
      }
    });
  });
}

// Render selected images
function renderSelectedImages() {
  selectedImagesEl.innerHTML = selectedProjectImages.map(id => {
    const img = images[id];
    if (!img) return '';
    const isThumbnail = projectThumbnail === id;
    return `
      <div class="selected-image-item ${isThumbnail ? 'is-thumbnail' : ''}" data-id="${id}">
        <img src="${getImageUrl(id, 400)}" alt="${img.alt || id}">
        <button class="remove-image" title="Remove">&times;</button>
        <button class="set-thumbnail" title="Set as thumbnail">★</button>
      </div>
    `;
  }).join('');

  // Add handlers for remove and thumbnail buttons
  selectedImagesEl.querySelectorAll('.selected-image-item').forEach(item => {
    const imageId = item.dataset.id;

    item.querySelector('.remove-image').addEventListener('click', (e) => {
      e.stopPropagation();
      selectedProjectImages = selectedProjectImages.filter(id => id !== imageId);
      if (projectThumbnail === imageId) {
        projectThumbnail = selectedProjectImages[0] || null;
      }
      renderImagePicker();
    });

    item.querySelector('.set-thumbnail').addEventListener('click', (e) => {
      e.stopPropagation();
      projectThumbnail = imageId;
      renderSelectedImages();
    });
  });

  // Initialize drag-and-drop for selected images
  initSelectedImagesSortable();
}

// Initialize Sortable for selected images
function initSelectedImagesSortable() {
  if (selectedImagesSortable) {
    selectedImagesSortable.destroy();
  }

  if (selectedImagesEl.children.length === 0) return;

  selectedImagesSortable = new Sortable(selectedImagesEl, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: () => {
      // Update selectedProjectImages order
      const items = selectedImagesEl.querySelectorAll('.selected-image-item');
      selectedProjectImages = Array.from(items).map(item => item.dataset.id);
    }
  });
}

// Save project
async function handleProjectSave() {
  const id = projectIdInput.value.trim();

  if (!id) {
    alert('Project ID is required');
    return;
  }

  // Check for duplicate ID when creating
  if (!editingProject && projects.some(p => p.id === id)) {
    alert('A project with this ID already exists');
    return;
  }

  const category = projectCategorySelect.value;

  // Calculate rank for new projects (add to end of category list)
  let rank = editingProject?.rank ?? 0;
  if (!editingProject) {
    const categoryProjects = projects.filter(p => p.category === category);
    rank = categoryProjects.length > 0
      ? Math.max(...categoryProjects.map(p => p.rank ?? 0)) + 1
      : 0;
  }

  const projectData = {
    id,
    title: projectTitleInput.value.trim(),
    category,
    rank,
    thumbnail: projectThumbnail,
    shortDescription: projectShortDescInput.value.trim(),
    fullDescription: projectFullDescInput.value.trim(),
    year: projectYearInput.value.trim(),
    location: projectLocationInput.value.trim(),
    type: projectTypeInput.value.trim(),
    images: selectedProjectImages
  };

  projectSaveBtn.disabled = true;
  projectSaveBtn.textContent = 'Saving...';

  try {
    const url = editingProject
      ? `/api/projects/${id}`
      : '/api/projects';
    const method = editingProject ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save project');
    }

    await loadProjects();
    markAsChanged();
    closeProjectModal();
  } catch (error) {
    console.error('Save project error:', error);
    alert(error.message || 'Failed to save project');
  } finally {
    projectSaveBtn.disabled = false;
    projectSaveBtn.textContent = 'Save Project';
  }
}

// Delete project
async function handleProjectDelete() {
  if (!editingProject) return;

  if (!confirm(`Are you sure you want to delete "${editingProject.title}"?`)) {
    return;
  }

  deleteProjectBtn.disabled = true;
  deleteProjectBtn.textContent = 'Deleting...';

  try {
    const res = await fetch(`/api/projects/${editingProject.id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      throw new Error('Failed to delete project');
    }

    await loadProjects();
    markAsChanged();
    closeProjectModal();
  } catch (error) {
    console.error('Delete project error:', error);
    alert('Failed to delete project');
  } finally {
    deleteProjectBtn.disabled = false;
    deleteProjectBtn.textContent = 'Delete Project';
  }
}

// Setup project event listeners
function setupProjectListeners() {
  newProjectBtn.addEventListener('click', () => openProjectModal());
  projectSaveBtn.addEventListener('click', handleProjectSave);
  projectCancelBtn.addEventListener('click', closeProjectModal);
  deleteProjectBtn.addEventListener('click', handleProjectDelete);

  // Close modal on backdrop click
  projectModal.addEventListener('click', (e) => {
    if (e.target === projectModal) closeProjectModal();
  });

  // Close button in modal header
  projectModal.querySelector('.modal-close').addEventListener('click', closeProjectModal);
}

// ============ PUBLISH ============

const publishBtn = document.getElementById('publish-btn');
const publishStatusEl = document.getElementById('publish-status');
const publishDiffBtn = document.getElementById('publish-diff-btn');
const publishDiffPopover = document.getElementById('publish-diff-popover');

let deployPollInterval = null;
let lastKnownDeployId = null;

// Unpublished-changes state lives on the server (see /api/publish-state),
// so it survives reloads and is consistent across browsers. These locals
// just mirror it between fetches.
let unpublishedChanges = false;
let lastPublishedAt = null;

async function loadPublishState() {
  try {
    const res = await fetch('/api/publish-state');
    if (!res.ok) return;
    const state = await res.json();
    unpublishedChanges = state.hasUnpublishedChanges;
    lastPublishedAt = state.lastPublishedAt;
    updatePublishBadge();
  } catch (error) {
    console.error('Failed to load publish state:', error);
  }
}

// Track unpublished changes (the server stamps content_modified_at as part
// of the mutation itself; this just updates the UI without a refetch)
function markAsChanged() {
  unpublishedChanges = true;
  publishDiffCache = null;
  updatePublishBadge();
}

function markAsPublished() {
  unpublishedChanges = false;
  lastPublishedAt = new Date().toISOString();
  publishDiffCache = null;
  updatePublishBadge();
}

function hasUnpublishedChanges() {
  return unpublishedChanges;
}

function formatRelativeTime(isoString) {
  const minutes = Math.round((Date.now() - Date.parse(isoString)) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function updatePublishBadge() {
  const badge = document.getElementById('unpublished-badge');
  if (!badge) return;

  if (hasUnpublishedChanges()) {
    badge.classList.remove('hidden');
    publishBtn.title = 'You have unpublished changes';
    publishStatusEl.textContent = 'Unpublished changes';
    publishStatusEl.className = 'publish-status has-changes';
    publishDiffBtn.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    publishBtn.title = 'Publish changes to live site';
    publishStatusEl.textContent = lastPublishedAt
      ? `Up to date · published ${formatRelativeTime(lastPublishedAt)}`
      : 'Up to date';
    publishStatusEl.className = 'publish-status';
    publishDiffBtn.classList.add('hidden');
    hidePublishDiff();
  }
}

// ---- "What changed?" popover ----

let publishDiffCache = null;

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderPublishDiff(diff) {
  if (!diff.available) {
    return '<div class="diff-empty">Change details will be available after the next publish.</div>';
  }
  if (diff.clean) {
    return '<div class="diff-empty">No content differences from the last publish.</div>';
  }

  const lines = [];
  const line = (label, detail) => lines.push(
    `<li><span class="diff-name">${escapeHtml(label)}</span>${
      detail ? ` <span class="diff-detail">— ${escapeHtml(detail)}</span>` : ''
    }</li>`
  );

  if (diff.profileChanged) line('Profile updated');
  for (const p of diff.projects.added) line(`New project: ${p.title || p.id}`);
  for (const p of diff.projects.deleted) line(`Deleted project: ${p.title || p.id}`);
  for (const p of diff.projects.modified) line(p.title || p.id, p.fields.join(', '));
  for (const category of diff.projects.reordered) {
    line(category === 'big' ? 'Big projects reordered' : 'Little projects reordered');
  }
  for (const id of diff.images.added) line(`New image: ${id}`);
  for (const id of diff.images.deleted) line(`Deleted image: ${id}`);
  for (const img of diff.images.modified) line(`Image: ${img.id}`, img.changes.join(', '));

  return `<ul class="diff-list">${lines.join('')}</ul>`;
}

async function showPublishDiff() {
  publishDiffPopover.classList.remove('hidden');

  if (!publishDiffCache) {
    publishDiffPopover.innerHTML = '<div class="diff-empty">Loading…</div>';
    try {
      const res = await fetch('/api/publish-diff');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      publishDiffCache = await res.json();
    } catch (error) {
      console.error('Failed to load publish diff:', error);
      publishDiffPopover.innerHTML = '<div class="diff-empty">Failed to load changes.</div>';
      return;
    }
  }

  publishDiffPopover.innerHTML = renderPublishDiff(publishDiffCache);
}

function hidePublishDiff() {
  publishDiffPopover.classList.add('hidden');
}

publishDiffBtn.addEventListener('mouseenter', showPublishDiff);
publishDiffBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (publishDiffPopover.classList.contains('hidden')) {
    showPublishDiff();
  } else {
    hidePublishDiff();
  }
});

// Close when the pointer leaves the icon+popover area, or on outside click
document.addEventListener('click', (e) => {
  if (!publishDiffPopover.contains(e.target) && e.target !== publishDiffBtn) {
    hidePublishDiff();
  }
});
publishDiffBtn.addEventListener('mouseleave', (e) => {
  if (e.relatedTarget && publishDiffPopover.contains(e.relatedTarget)) return;
  hidePublishDiff();
});
publishDiffPopover.addEventListener('mouseleave', (e) => {
  if (e.relatedTarget === publishDiffBtn) return;
  hidePublishDiff();
});

function resetPublishButton() {
  publishBtn.innerHTML = '<span class="publish-icon">🚀</span> Publish <span id="unpublished-badge" class="unpublished-badge hidden">●</span>';
  publishBtn.disabled = false;
  publishBtn.className = 'btn btn-publish';
  updatePublishBadge();
}

function setPublishButtonState(icon, text, className) {
  const badge = hasUnpublishedChanges() ? '<span id="unpublished-badge" class="unpublished-badge">●</span>' : '<span id="unpublished-badge" class="unpublished-badge hidden">●</span>';
  publishBtn.innerHTML = `<span class="publish-icon">${icon}</span> ${text} ${badge}`;
  publishBtn.className = `btn btn-publish ${className}`;
}

async function checkDeployStatus() {
  try {
    const res = await fetch('/api/deploy-status');

    if (!res.ok) {
      // API not configured, stop polling
      stopPolling();
      return;
    }

    const data = await res.json();

    // If this is a new deploy (different ID), track it
    if (data.deployId && data.deployId !== lastKnownDeployId) {
      lastKnownDeployId = data.deployId;
    }

    switch (data.status) {
      case 'queued':
        setPublishButtonState('⏳', 'Queued...', 'publishing');
        break;
      case 'building':
        setPublishButtonState('🔨', 'Building...', 'publishing');
        break;
      case 'deploying':
        setPublishButtonState('📤', 'Deploying...', 'publishing');
        break;
      case 'ready':
        setPublishButtonState('✓', 'Live!', 'published');
        stopPolling();
        // Reset button after a few seconds
        setTimeout(resetPublishButton, 4000);
        break;
      case 'error':
        setPublishButtonState('✗', 'Failed', 'publish-error');
        stopPolling();
        setTimeout(resetPublishButton, 5000);
        break;
      default:
        // Unknown state, keep polling
        break;
    }
  } catch (error) {
    console.error('Failed to check deploy status:', error);
  }
}

function startPolling() {
  // Poll every 3 seconds
  if (deployPollInterval) clearInterval(deployPollInterval);
  deployPollInterval = setInterval(checkDeployStatus, 3000);
  // Also check immediately
  checkDeployStatus();
}

function stopPolling() {
  if (deployPollInterval) {
    clearInterval(deployPollInterval);
    deployPollInterval = null;
  }
}

async function handlePublish() {
  publishBtn.disabled = true;
  setPublishButtonState('⏳', 'Starting...', 'publishing');

  try {
    const res = await fetch('/api/publish', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Publish failed');
    }

    markAsPublished();

    // Start polling for deploy status
    lastKnownDeployId = null; // Reset so we catch the new deploy
    startPolling();

  } catch (error) {
    console.error('Publish error:', error);
    setPublishButtonState('✗', 'Error', 'publish-error');
    setTimeout(resetPublishButton, 3000);
  }
}

// ============ PROFILE ============
// Hallie's profile page (hallieblack.com). The CV is edited as plain text,
// one "years | title | detail" line per entry, and parsed on save.

const profileFields = {
  name: document.getElementById('profile-name'),
  role: document.getElementById('profile-role'),
  location: document.getElementById('profile-location'),
  bio: document.getElementById('profile-bio'),
  email: document.getElementById('profile-email'),
  phone: document.getElementById('profile-phone'),
  featuredProjectId: document.getElementById('profile-featured'),
};
const cvSectionsEl = document.getElementById('cv-sections');
const profileSaveBtn = document.getElementById('profile-save-btn');
const profileSaveStatus = document.getElementById('profile-save-status');
const profileUnsavedNote = document.getElementById('profile-unsaved-note');

let profileDirty = false;

function entriesToText(entries) {
  return entries
    .map(e => [e.years, e.title, e.detail].filter((v, i) => v || i < 2).join(' | '))
    .join('\n');
}

function textToEntries(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [years = '', title = '', ...rest] = line.split('|').map(part => part.trim());
      return { years, title, detail: rest.join(' | ') };
    });
}

function renderCvSection(section = { heading: '', entries: [] }) {
  const el = document.createElement('div');
  el.className = 'cv-section-editor';
  el.innerHTML = `
    <div class="cv-section-editor-header">
      <input type="text" class="cv-heading" placeholder="Section heading, e.g. Education">
      <button class="btn btn-secondary btn-small" data-action="up" title="Move up">↑</button>
      <button class="btn btn-secondary btn-small" data-action="down" title="Move down">↓</button>
      <button class="btn btn-danger btn-small" data-action="remove" title="Remove section">Remove</button>
    </div>
    <textarea class="cv-entries" rows="4" placeholder="2018–2021 | Project Architect, Firm Name | Los Angeles"></textarea>
  `;
  el.querySelector('.cv-heading').value = section.heading;
  el.querySelector('.cv-entries').value = entriesToText(section.entries);
  return el;
}

function readCvSections() {
  return [...cvSectionsEl.querySelectorAll('.cv-section-editor')].map(el => ({
    heading: el.querySelector('.cv-heading').value.trim(),
    entries: textToEntries(el.querySelector('.cv-entries').value),
  }));
}

async function renderFeaturedOptions(selectedId) {
  if (!projects.length) {
    try {
      const res = await fetch('/api/projects');
      projects = (await res.json()).projects || [];
    } catch {
      projects = [];
    }
  }
  const big = projects
    .filter(p => p.category === 'big')
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const select = profileFields.featuredProjectId;
  select.innerHTML = '<option value="">First big project (default)</option>' +
    big.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title || p.id)}</option>`).join('');
  select.value = big.some(p => p.id === selectedId) ? selectedId : '';
}

function setProfileStatus(text, className = '') {
  profileSaveStatus.textContent = text;
  profileSaveStatus.className = `profile-save-status ${className}`;
}

async function loadProfile() {
  if (profileDirty) return; // don't clobber edits when switching tabs
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { profile, saved } = await res.json();

    for (const [key, input] of Object.entries(profileFields)) {
      if (key !== 'featuredProjectId') input.value = profile[key] || '';
    }
    await renderFeaturedOptions(profile.featuredProjectId);

    cvSectionsEl.innerHTML = '';
    for (const section of profile.cv) cvSectionsEl.appendChild(renderCvSection(section));

    profileUnsavedNote.classList.toggle('hidden', saved);
    setProfileStatus('');
  } catch (error) {
    console.error('Failed to load profile:', error);
    setProfileStatus('Failed to load profile', 'error');
  }
}

async function handleProfileSave() {
  const profile = { cv: readCvSections() };
  for (const [key, input] of Object.entries(profileFields)) profile[key] = input.value.trim();

  profileSaveBtn.disabled = true;
  setProfileStatus('Saving…');
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to save profile');

    profileDirty = false;
    profileUnsavedNote.classList.add('hidden');
    markAsChanged();
    setProfileStatus('Saved', 'success');
    // Re-render from what the server kept (blank CV lines are dropped)
    await loadProfile();
    setProfileStatus('Saved', 'success');
  } catch (error) {
    console.error('Save profile error:', error);
    setProfileStatus(error.message || 'Failed to save profile', 'error');
  } finally {
    profileSaveBtn.disabled = false;
  }
}

function setupProfileListeners() {
  profileSaveBtn.addEventListener('click', handleProfileSave);

  document.getElementById('cv-add-section-btn').addEventListener('click', () => {
    const el = renderCvSection();
    cvSectionsEl.appendChild(el);
    el.querySelector('.cv-heading').focus();
    profileDirty = true;
  });

  cvSectionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const el = btn.closest('.cv-section-editor');
    if (btn.dataset.action === 'up' && el.previousElementSibling) {
      el.parentNode.insertBefore(el, el.previousElementSibling);
    } else if (btn.dataset.action === 'down' && el.nextElementSibling) {
      el.parentNode.insertBefore(el.nextElementSibling, el);
    } else if (btn.dataset.action === 'remove') {
      const heading = el.querySelector('.cv-heading').value.trim() || 'this section';
      if (!confirm(`Remove ${heading}?`)) return;
      el.remove();
    } else {
      return;
    }
    profileDirty = true;
    setProfileStatus('Unsaved changes', 'pending');
  });

  document.getElementById('profile-section').addEventListener('input', () => {
    profileDirty = true;
    setProfileStatus('Unsaved changes', 'pending');
  });

  window.addEventListener('beforeunload', (e) => {
    if (profileDirty) e.preventDefault();
  });
}

// Initialize badge from server state on page load
loadPublishState();

publishBtn.addEventListener('click', handlePublish);

// Start
setupTabs();
setupProjectListeners();
setupProfileListeners();
init();
