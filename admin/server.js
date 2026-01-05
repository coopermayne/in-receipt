import express from 'express';
import multer from 'multer';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const IMAGES_JSON_PATH = join(__dirname, '../src/data/images.json');

// Check env vars
if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN environment variables');
  process.exit(1);
}

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Get all images
app.get('/api/images', async (req, res) => {
  try {
    const data = await readFile(IMAGES_JSON_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.json({});
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

    // Read current images
    let images = {};
    try {
      const data = await readFile(IMAGES_JSON_PATH, 'utf-8');
      images = JSON.parse(data);
    } catch {
      // File doesn't exist or is empty
    }

    // Add/update image
    images[id] = imageData;

    // Write back
    await writeFile(IMAGES_JSON_PATH, JSON.stringify(images, null, 2));

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

    // Read current images
    const data = await readFile(IMAGES_JSON_PATH, 'utf-8');
    const images = JSON.parse(data);

    if (!images[id]) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from Cloudflare first
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1/${images[id].cloudflareId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    const cfData = await cfResponse.json();

    // Only remove from JSON if Cloudflare deletion succeeded
    if (!cfData.success) {
      console.error('Cloudflare delete error:', cfData.errors);
      return res.status(500).json({
        error: 'Failed to delete from Cloudflare',
        details: cfData.errors
      });
    }

    // Remove from JSON only after confirmed deletion from Cloudflare
    delete images[id];
    await writeFile(IMAGES_JSON_PATH, JSON.stringify(images, null, 2));

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Admin server running at http://localhost:${PORT}`);
});
