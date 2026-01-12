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
      <img src="${getImageUrl(img.accountHash, img.cloudflareId, 'public')}" alt="${img.alt || ''}"
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

// Get Cloudflare image URL
function getImageUrl(accountHash, cloudflareId, variant = 'public') {
  return `https://imagedelivery.net/${accountHash}/${cloudflareId}/${variant}`;
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

  const imageUrl = getImageUrl(img.accountHash, img.cloudflareId, 'public');
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
    // Upload to Cloudflare
    const formData = new FormData();
    formData.append('image', currentFile);

    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      throw new Error('Upload failed');
    }

    const uploadData = await uploadRes.json();

    // Save metadata
    const id = imageIdInput.value.trim();
    const imageData = {
      cloudflareId: uploadData.cloudflareId,
      accountHash: uploadData.accountHash,
      focalPoint: { ...focalPoint },
      alt: imageAltInput.value.trim(),
      filename: uploadData.filename,
      uploadedAt: new Date().toISOString()
    };

    const saveRes = await fetch(`/api/images/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageData)
    });

    if (!saveRes.ok) {
      throw new Error('Save failed');
    }

    // Reload and close
    await loadImages();
    markAsChanged();
    closeModals();
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to upload image. Please try again.');
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
let projectsSortableResidential = null;
let projectsSortableCommercial = null;
let selectedImagesSortable = null;

// Projects Elements
const projectsListResidential = document.getElementById('projects-list-residential');
const projectsListCommercial = document.getElementById('projects-list-commercial');
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

// Tab Switching
function setupTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // Update tab buttons
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update sections
      if (targetTab === 'images') {
        imagesSection.classList.remove('hidden');
        projectsSection.classList.add('hidden');
      } else {
        imagesSection.classList.add('hidden');
        projectsSection.classList.remove('hidden');
        loadProjects();
      }
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
  const residential = projects
    .filter(p => p.category === 'residential')
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const commercial = projects
    .filter(p => p.category === 'commercial')
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

  // Render residential column
  if (residential.length === 0) {
    projectsListResidential.innerHTML = `
      <div class="empty-state">
        <p>No residential projects yet.</p>
      </div>
    `;
  } else {
    projectsListResidential.innerHTML = residential.map(project => renderProjectCard(project)).join('');
  }

  // Render commercial column
  if (commercial.length === 0) {
    projectsListCommercial.innerHTML = `
      <div class="empty-state">
        <p>No commercial projects yet.</p>
      </div>
    `;
  } else {
    projectsListCommercial.innerHTML = commercial.map(project => renderProjectCard(project)).join('');
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

// Render a single project card
function renderProjectCard(project) {
  const thumbnailImg = images[project.thumbnail];
  const thumbnailUrl = thumbnailImg
    ? getImageUrl(thumbnailImg.accountHash, thumbnailImg.cloudflareId, 'public')
    : '';

  return `
    <div class="project-card" data-id="${project.id}">
      <div class="project-drag-handle">⋮⋮</div>
      ${thumbnailUrl
        ? `<img class="project-thumbnail" src="${thumbnailUrl}" alt="${project.title}">`
        : `<div class="project-thumbnail"></div>`
      }
      <div class="project-info">
        <div class="project-title">${project.title}</div>
        <div class="project-meta">${project.location} · ${project.year}</div>
      </div>
    </div>
  `;
}

// Initialize Sortable for projects list
function initProjectsSortable() {
  if (projectsSortableResidential) {
    projectsSortableResidential.destroy();
  }
  if (projectsSortableCommercial) {
    projectsSortableCommercial.destroy();
  }

  // Only init if there are cards (not empty state)
  if (projectsListResidential.querySelector('.project-card')) {
    projectsSortableResidential = new Sortable(projectsListResidential, {
      animation: 150,
      handle: '.project-drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: () => handleProjectReorder('residential', projectsListResidential)
    });
  }
  if (projectsListCommercial.querySelector('.project-card')) {
    projectsSortableCommercial = new Sortable(projectsListCommercial, {
      animation: 150,
      handle: '.project-drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: () => handleProjectReorder('commercial', projectsListCommercial)
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
    projectCategorySelect.value = 'residential';
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
        <img src="${getImageUrl(img.accountHash, img.cloudflareId, 'public')}" alt="${img.alt || id}">
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
        <img src="${getImageUrl(img.accountHash, img.cloudflareId, 'public')}" alt="${img.alt || id}">
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
const unpublishedBadge = document.getElementById('unpublished-badge');

// Track unpublished changes
function markAsChanged() {
  localStorage.setItem('hasUnpublishedChanges', 'true');
  updatePublishBadge();
}

function markAsPublished() {
  localStorage.removeItem('hasUnpublishedChanges');
  updatePublishBadge();
}

function hasUnpublishedChanges() {
  return localStorage.getItem('hasUnpublishedChanges') === 'true';
}

function updatePublishBadge() {
  if (hasUnpublishedChanges()) {
    unpublishedBadge.classList.remove('hidden');
    publishBtn.title = 'You have unpublished changes';
  } else {
    unpublishedBadge.classList.add('hidden');
    publishBtn.title = 'Publish changes to live site';
  }
}

async function handlePublish() {
  const hasChanges = hasUnpublishedChanges();
  const message = hasChanges
    ? 'Publish all changes to the live site?\n\nBuild typically takes 1-2 minutes.'
    : 'No changes detected, but publish anyway?\n\nBuild typically takes 1-2 minutes.';

  if (!confirm(message)) {
    return;
  }

  publishBtn.disabled = true;
  publishBtn.innerHTML = '<span class="publish-icon">⏳</span> Building...';

  try {
    const res = await fetch('/api/publish', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Publish failed');
    }

    markAsPublished();
    publishBtn.innerHTML = '<span class="publish-icon">✓</span> Build started!';

    setTimeout(() => {
      publishBtn.innerHTML = '<span class="publish-icon">🚀</span> Publish <span id="unpublished-badge" class="unpublished-badge hidden">●</span>';
      publishBtn.disabled = false;
      // Re-get the badge element since we replaced innerHTML
      updatePublishBadge();
    }, 3000);
  } catch (error) {
    console.error('Publish error:', error);
    alert(error.message || 'Failed to publish. Is NETLIFY_BUILD_HOOK configured?');
    publishBtn.innerHTML = '<span class="publish-icon">🚀</span> Publish <span id="unpublished-badge" class="unpublished-badge hidden">●</span>';
    publishBtn.disabled = false;
    updatePublishBadge();
  }
}

// Initialize badge on page load
updatePublishBadge();

publishBtn.addEventListener('click', handlePublish);

// Start
setupTabs();
setupProjectListeners();
init();
