import express from 'express';
import multer from 'multer';
import basicAuth from 'express-basic-auth';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Check required env vars
const requiredEnvVars = {
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
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

// Initialize Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Basic authentication middleware
app.use(basicAuth({
  users: { [ADMIN_USER]: ADMIN_PASSWORD },
  challenge: true,
  realm: 'Admin Panel',
}));

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Helper: Convert Supabase row to frontend format (for images)
function rowToImageData(row) {
  return {
    cloudflareId: row.cloudflare_id,
    accountHash: row.account_hash,
    focalPoint: {
      x: parseFloat(row.focal_point_x),
      y: parseFloat(row.focal_point_y),
    },
    alt: row.alt,
    filename: row.filename,
    width: row.width,
    height: row.height,
    uploadedAt: row.uploaded_at,
  };
}

// Helper: Convert frontend format to Supabase row (for images)
function imageDataToRow(id, data) {
  return {
    id,
    cloudflare_id: data.cloudflareId,
    account_hash: data.accountHash,
    focal_point_x: data.focalPoint?.x ?? 0.5,
    focal_point_y: data.focalPoint?.y ?? 0.5,
    alt: data.alt || null,
    filename: data.filename || null,
    width: data.width || null,
    height: data.height || null,
    uploaded_at: data.uploadedAt || new Date().toISOString(),
  };
}

// Helper: Convert Supabase row to frontend format (for projects)
function rowToProjectData(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    thumbnail: row.thumbnail,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    year: row.year,
    location: row.location,
    type: row.type,
    images: row.images || [],
    rank: row.rank,
  };
}

// Helper: Convert frontend format to Supabase row (for projects)
function projectDataToRow(data) {
  return {
    id: data.id,
    title: data.title,
    category: data.category,
    thumbnail: data.thumbnail || null,
    short_description: data.shortDescription || null,
    full_description: data.fullDescription || null,
    year: data.year || null,
    location: data.location || null,
    type: data.type || null,
    images: data.images || [],
    rank: data.rank ?? 0,
  };
}

// ============ IMAGES API ============

// Get all images
app.get('/api/images', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('*');

    if (error) throw error;

    // Convert to object keyed by ID (matching original format)
    const images = {};
    for (const row of data) {
      images[row.id] = rowToImageData(row);
    }

    res.json(images);
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({ error: 'Failed to get images' });
  }
});

// Upload image to Cloudflare
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer]), req.file.originalname);

    // Upload to Cloudflare Images
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: formData,
      }
    );

    const cfData = await cfResponse.json();

    if (!cfData.success) {
      console.error('Cloudflare error:', cfData.errors);
      return res.status(500).json({ error: 'Cloudflare upload failed', details: cfData.errors });
    }

    // Extract account hash from variant URL
    // Format: https://imagedelivery.net/<account_hash>/<image_id>/<variant>
    const variantUrl = cfData.result.variants[0];
    const accountHash = variantUrl.split('/')[3];

    res.json({
      cloudflareId: cfData.result.id,
      accountHash: accountHash,
      variants: cfData.result.variants,
      filename: req.file.originalname,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Save image metadata
app.post('/api/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const imageData = req.body;

    const row = imageDataToRow(id, imageData);

    const { error } = await supabase
      .from('images')
      .upsert(row, { onConflict: 'id' });

    if (error) throw error;

    res.json({ success: true, id });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Save failed' });
  }
});

// Delete image
app.delete('/api/images/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get image from Supabase first
    const { data: image, error: fetchError } = await supabase
      .from('images')
      .select('cloudflare_id')
      .eq('id', id)
      .single();

    if (fetchError || !image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from Cloudflare first
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1/${image.cloudflare_id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    const cfData = await cfResponse.json();

    // Only remove from Supabase if Cloudflare deletion succeeded
    if (!cfData.success) {
      console.error('Cloudflare delete error:', cfData.errors);
      return res.status(500).json({
        error: 'Failed to delete from Cloudflare',
        details: cfData.errors
      });
    }

    // Remove from Supabase
    const { error: deleteError } = await supabase
      .from('images')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Get Cloudflare delivery URL base
app.get('/api/config', (req, res) => {
  res.json({
    accountId: CLOUDFLARE_ACCOUNT_ID,
  });
});

// ============ PROJECTS API ============

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('rank', { ascending: true });

    if (error) throw error;

    const projects = data.map(rowToProjectData);

    res.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// Reorder projects (updates ranks for a specific category)
// NOTE: Must be defined before /api/projects/:id to avoid route conflict
app.put('/api/projects/reorder', async (req, res) => {
  try {
    const { category, projectIds } = req.body;

    if (!category || !Array.isArray(projectIds)) {
      return res.status(400).json({ error: 'category and projectIds are required' });
    }

    // Update ranks for each project
    const updates = projectIds.map((id, index) =>
      supabase
        .from('projects')
        .update({ rank: index })
        .eq('id', id)
        .eq('category', category)
    );

    await Promise.all(updates);

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder projects error:', error);
    res.status(500).json({ error: 'Failed to reorder projects' });
  }
});

// Create new project
app.post('/api/projects', async (req, res) => {
  try {
    const newProject = req.body;

    // Check if ID already exists
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', newProject.id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Project ID already exists' });
    }

    const row = projectDataToRow(newProject);

    const { error } = await supabase
      .from('projects')
      .insert(row);

    if (error) throw error;

    res.json({ success: true, project: newProject });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
app.put('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedProject = req.body;

    // Ensure ID matches
    const row = projectDataToRow({ ...updatedProject, id });

    const { data, error } = await supabase
      .from('projects')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Project not found' });
      }
      throw error;
    }

    res.json({ success: true, project: rowToProjectData(data) });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error, count } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Check if anything was deleted
    if (count === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Admin server running at http://localhost:${PORT}`);
});
