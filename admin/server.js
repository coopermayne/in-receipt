import express from 'express';
import multer from 'multer';
import basicAuth from 'express-basic-auth';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  listImages,
  getImage,
  upsertImage,
  updateImageMeta,
  deleteImage,
  listProjects,
  projectExists,
  insertProject,
  updateProject,
  deleteProject,
  reorderProjects,
  getContent,
  recordPublish,
  getPublishState,
  getPublishDiff,
  getProfile,
  setProfile,
  DEFAULT_PROFILE,
  listImagesMissingThumbhash,
  setThumbhash,
  DB_PATH,
} from './db.js';
import {
  isValidImageId,
  parseTransform,
  getDerivative,
  storeOriginal,
  deleteStored,
  clearCache,
  unlinkOriginal,
  warmCache,
  computeThumbhash,
  originalPath,
} from './images.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 50MB ceiling on uploads; originals are kept untouched, but a stray huge file
// shouldn't be buffered into memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Environment variables
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Check required env vars
const requiredEnvVars = {
  ADMIN_USER,
  ADMIN_PASSWORD,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error(`Missing environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

app.use(express.json());

// ============ PUBLIC API ============
// Registered before the auth middleware. The Astro build has no credentials,
// and this is the same data the site publishes anyway.

// Everything the site needs to build, in one request.
app.get('/api/content', (req, res) => {
  try {
    res.json(getContent());
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ error: 'Failed to get content' });
  }
});

// Liveness check, useful for Coolify and for debugging failed builds.
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Image delivery. Derivatives are generated on first request from the stored
// original, then served from the cache directory. The transform is whitelisted
// (see images.js) so the cache can't be inflated by arbitrary requests.
app.get('/img/:id/:transform', async (req, res) => {
  const { id, transform: transformName } = req.params;

  if (!isValidImageId(id)) {
    return res.status(400).json({ error: 'Invalid image id' });
  }

  const transform = parseTransform(transformName);
  if (!transform) {
    return res.status(400).json({ error: 'Unsupported transform' });
  }

  const image = getImage(id);
  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  try {
    const path = await getDerivative({ id, ...image }, transform);

    // Paths are immutable: a given transform of a given id never changes,
    // and replacing an image clears its cache directory.
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('image/webp');
    res.sendFile(path);
  } catch (error) {
    console.error(`Derivative failed for ${id}/${transformName}:`, error);
    res.status(500).json({ error: 'Failed to render image' });
  }
});

// ============ AUTHENTICATED ROUTES ============

app.use(basicAuth({
  users: { [ADMIN_USER]: ADMIN_PASSWORD },
  challenge: true,
  realm: 'Admin Panel',
}));

app.use(express.static(join(__dirname, 'public')));

// ============ IMAGES API ============

// Get all images
app.get('/api/images', (req, res) => {
  try {
    res.json(listImages());
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({ error: 'Failed to get images' });
  }
});

// Create or replace an image. Accepts multipart (a file plus a JSON `data`
// field) when uploading, or a plain JSON body to edit metadata of an image
// that already exists. Storing the file and its row in one request means a
// failure can't leave an orphaned file or a row pointing at nothing.
app.post('/api/images/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;

  if (!isValidImageId(id)) {
    return res.status(400).json({
      error: 'Image id must be letters, numbers, dashes or underscores',
    });
  }

  let data;
  try {
    data = req.file ? JSON.parse(req.body.data || '{}') : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid data field' });
  }

  // Metadata-only edit
  if (!req.file) {
    const existing = getImage(id);
    if (!existing || !updateImageMeta(id, data)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Cover derivatives are cropped around the focal point, so moving it
    // invalidates them. Alt-only edits keep the cache.
    const newX = data.focalPoint?.x ?? 0.5;
    const newY = data.focalPoint?.y ?? 0.5;
    if (existing.focalPoint.x !== newX || existing.focalPoint.y !== newY) {
      await clearCache(id);
      warmCache({ id, ...getImage(id) });
    }

    return res.json({ success: true, id });
  }

  try {
    const existing = getImage(id);

    const stored = await storeOriginal(id, req.file.buffer, req.file.originalname);

    // Replacing an image invalidates every derivative of the old one, and
    // leaves the previous original orphaned if the format changed.
    if (existing) {
      await clearCache(id);
      if (existing.ext !== stored.ext) {
        await unlinkOriginal(id, existing.ext);
      }
    }

    upsertImage(id, {
      ...stored,
      focalPoint: data.focalPoint,
      alt: data.alt,
      uploadedAt: data.uploadedAt,
    });

    warmCache({ id, ...getImage(id) });

    res.json({ success: true, id, width: stored.width, height: stored.height });
  } catch (error) {
    console.error('Save error:', error);
    res.status(400).json({ error: error.message || 'Save failed' });
  }
});

// Delete image
app.delete('/api/images/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const image = getImage(id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Remove the row first: a stray file on disk is harmless, but a row
    // pointing at a missing file breaks the site's build.
    deleteImage(id);
    await deleteStored(id, image.ext);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ============ PROJECTS API ============

// Get all projects
app.get('/api/projects', (req, res) => {
  try {
    res.json({ projects: listProjects() });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// Reorder projects (updates ranks for a specific category)
// NOTE: Must be defined before /api/projects/:id to avoid route conflict
app.put('/api/projects/reorder', (req, res) => {
  try {
    const { category, projectIds } = req.body;

    if (!category || !Array.isArray(projectIds)) {
      return res.status(400).json({ error: 'category and projectIds are required' });
    }

    reorderProjects(category, projectIds);

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder projects error:', error);
    res.status(500).json({ error: 'Failed to reorder projects' });
  }
});

// Create new project
app.post('/api/projects', (req, res) => {
  try {
    const newProject = req.body;

    if (!newProject.id || !newProject.title || !newProject.category) {
      return res.status(400).json({ error: 'id, title and category are required' });
    }

    if (newProject.category !== 'big' && newProject.category !== 'small') {
      return res.status(400).json({ error: "category must be 'big' or 'small'" });
    }

    if (projectExists(newProject.id)) {
      return res.status(400).json({ error: 'Project ID already exists' });
    }

    insertProject(newProject);

    res.json({ success: true, project: newProject });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
app.put('/api/projects/:id', (req, res) => {
  try {
    const project = updateProject(req.params.id, req.body);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
app.delete('/api/projects/:id', (req, res) => {
  try {
    if (!deleteProject(req.params.id)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ============ PROFILE API ============

// Hallie's profile page. Until first saved, the form starts from defaults
// and the site keeps using its own fallback.
app.get('/api/profile', (req, res) => {
  try {
    const saved = getProfile();
    res.json({ profile: saved ?? DEFAULT_PROFILE, saved: saved !== null });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.put('/api/profile', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Expected a profile object' });
    }
    res.json({ success: true, profile: setProfile(req.body) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============ PUBLISH API ============

// Trigger Netlify rebuild
app.post('/api/publish', async (req, res) => {
  const buildHook = process.env.NETLIFY_BUILD_HOOK;

  if (!buildHook) {
    return res.status(500).json({ error: 'NETLIFY_BUILD_HOOK not configured' });
  }

  try {
    const response = await fetch(buildHook, { method: 'POST' });

    if (!response.ok) {
      throw new Error(`Netlify responded with ${response.status}`);
    }

    recordPublish();

    res.json({ success: true, message: 'Build triggered' });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Failed to trigger build' });
  }
});

// Whether content has changed since the last publish was triggered.
// Server-side state, so it's correct across browsers and devices.
app.get('/api/publish-state', (req, res) => {
  try {
    res.json(getPublishState());
  } catch (error) {
    console.error('Publish state error:', error);
    res.status(500).json({ error: 'Failed to get publish state' });
  }
});

// What the next publish would change: current content diffed against the
// snapshot taken when the last publish was triggered.
app.get('/api/publish-diff', (req, res) => {
  try {
    res.json(getPublishDiff());
  } catch (error) {
    console.error('Publish diff error:', error);
    res.status(500).json({ error: 'Failed to compute publish diff' });
  }
});

// Get latest Netlify deploy status
app.get('/api/deploy-status', async (req, res) => {
  const accessToken = process.env.NETLIFY_ACCESS_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!accessToken || !siteId) {
    return res.status(500).json({ error: 'Netlify API not configured' });
  }

  try {
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Netlify API responded with ${response.status}`);
    }

    const deploys = await response.json();

    if (deploys.length === 0) {
      return res.json({ status: 'unknown', message: 'No deploys found' });
    }

    const latest = deploys[0];

    // Map Netlify states to simpler status
    // Netlify states: new, pending_review, enqueued, building, uploading, uploaded, preparing, ready, error, retrying
    let status = 'unknown';
    let message = latest.state;

    switch (latest.state) {
      case 'new':
      case 'enqueued':
      case 'pending_review':
        status = 'queued';
        message = 'Build queued...';
        break;
      case 'building':
        status = 'building';
        message = 'Building site...';
        break;
      case 'uploading':
      case 'uploaded':
      case 'preparing':
        status = 'deploying';
        message = 'Deploying...';
        break;
      case 'ready':
        status = 'ready';
        message = 'Live!';
        break;
      case 'error':
        status = 'error';
        message = latest.error_message || 'Build failed';
        break;
      case 'retrying':
        status = 'building';
        message = 'Retrying build...';
        break;
    }

    res.json({
      status,
      message,
      deployId: latest.id,
      createdAt: latest.created_at,
      publishedAt: latest.published_at,
      deployUrl: latest.deploy_ssl_url,
    });
  } catch (error) {
    console.error('Deploy status error:', error);
    res.status(500).json({ error: 'Failed to get deploy status' });
  }
});

// Fill in ThumbHashes for images uploaded before they existed (or whose
// encode failed). Sequential and in the background, so startup isn't held up;
// the site picks them up on its next build.
async function backfillThumbhashes() {
  const missing = listImagesMissingThumbhash();
  if (!missing.length) return;

  let filled = 0;
  for (const image of missing) {
    const hash = await computeThumbhash(originalPath(image.id, image.ext));
    if (hash) {
      setThumbhash(image.id, hash);
      filled++;
    }
  }
  console.log(`ThumbHash backfill: ${filled} of ${missing.length} images`);
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Admin server running at http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  backfillThumbhashes().catch((error) => {
    console.error('ThumbHash backfill failed:', error);
  });
});
