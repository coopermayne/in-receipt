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
    document.getElementById(prefix + 'crop-square'),
    document.getElementById(prefix + 'crop-wide'),
    document.getElementById(prefix + 'crop-portrait'),
    document.getElementById(prefix + 'crop-landscape')
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
    closeModals();
  } catch (error) {
    console.error('Error:', error);
    alert(error.message || 'Failed to delete image. Please try again.');
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = 'Delete';
  }
}

// Start
init();
