import { readFile, writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const IMAGES_JSON_PATH = join(__dirname, '../src/data/images.json');

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

// Image configurations - mix of orientations and sizes
const imageConfigs = [
  // Landscapes (16:9 or similar) - good for hero images
  { id: 'landscape-2', width: 1920, height: 1080, seed: 'arch2' },
  { id: 'landscape-3', width: 1600, height: 900, seed: 'building1' },
  { id: 'landscape-4', width: 1600, height: 900, seed: 'building2' },
  { id: 'landscape-5', width: 1920, height: 1200, seed: 'interior1' },
  { id: 'landscape-6', width: 1920, height: 1200, seed: 'interior2' },
  { id: 'landscape-7', width: 1800, height: 1000, seed: 'design1' },
  { id: 'landscape-8', width: 1800, height: 1000, seed: 'design2' },
  { id: 'landscape-9', width: 2000, height: 1200, seed: 'space1' },
  { id: 'landscape-10', width: 2000, height: 1200, seed: 'space2' },
  { id: 'landscape-11', width: 1920, height: 1080, seed: 'modern1' },
  { id: 'landscape-12', width: 1920, height: 1080, seed: 'modern2' },

  // Portraits (3:4 or 2:3) - good for project cards
  { id: 'portrait-2', width: 1200, height: 1600, seed: 'house2' },
  { id: 'portrait-3', width: 1200, height: 1800, seed: 'room1' },
  { id: 'portrait-4', width: 1200, height: 1800, seed: 'room2' },
  { id: 'portrait-5', width: 1000, height: 1500, seed: 'facade1' },
  { id: 'portrait-6', width: 1000, height: 1500, seed: 'facade2' },
  { id: 'portrait-7', width: 1200, height: 1600, seed: 'tower1' },
  { id: 'portrait-8', width: 1200, height: 1600, seed: 'tower2' },
  { id: 'portrait-9', width: 1200, height: 1800, seed: 'door1' },
  { id: 'portrait-10', width: 1200, height: 1800, seed: 'door2' },
  { id: 'portrait-11', width: 1000, height: 1400, seed: 'window1' },
  { id: 'portrait-12', width: 1000, height: 1400, seed: 'window2' },
  { id: 'portrait-13', width: 1200, height: 1600, seed: 'hall1' },
  { id: 'portrait-14', width: 1200, height: 1600, seed: 'hall2' },

  // Squares (1:1) - versatile
  { id: 'square-2', width: 1200, height: 1200, seed: 'detail2' },
  { id: 'square-3', width: 1400, height: 1400, seed: 'texture1' },
  { id: 'square-4', width: 1400, height: 1400, seed: 'texture2' },
  { id: 'square-5', width: 1200, height: 1200, seed: 'corner1' },
  { id: 'square-6', width: 1200, height: 1200, seed: 'corner2' },
  { id: 'square-7', width: 1500, height: 1500, seed: 'light1' },
  { id: 'square-8', width: 1500, height: 1500, seed: 'light2' },

  // Wide landscapes (21:9 or panoramic) - for banners
  { id: 'wide-1', width: 2100, height: 900, seed: 'pano1' },
  { id: 'wide-2', width: 2100, height: 900, seed: 'pano2' },
  { id: 'wide-3', width: 2400, height: 1000, seed: 'skyline1' },
  { id: 'wide-4', width: 2400, height: 1000, seed: 'skyline2' },

  // Tall portraits (9:16) - for mobile-first cards
  { id: 'tall-1', width: 1080, height: 1920, seed: 'vertical1' },
  { id: 'tall-2', width: 1080, height: 1920, seed: 'vertical2' },
];

async function downloadImage(config) {
  const url = `https://picsum.photos/seed/${config.seed}/${config.width}/${config.height}`;
  console.log(`  Downloading ${config.id} (${config.width}x${config.height})...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${config.id}: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function uploadToCloudflare(imageBuffer, filename) {
  const formData = new FormData();
  formData.append('file', new Blob([imageBuffer]), filename);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
    }
  );

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Cloudflare upload failed: ${JSON.stringify(data.errors)}`);
  }

  // Extract account hash from variant URL
  const variantUrl = data.result.variants[0];
  const accountHash = variantUrl.split('/')[3];

  return {
    cloudflareId: data.result.id,
    accountHash: accountHash,
    variants: data.result.variants,
  };
}

function generateRandomFocalPoint() {
  // Generate focal points with some bias toward center (more realistic)
  // Use gaussian-like distribution centered at 0.5
  const randomBiased = () => {
    const r = (Math.random() + Math.random() + Math.random()) / 3;
    return 0.2 + r * 0.6; // Range: 0.2 to 0.8
  };

  return {
    x: Math.round(randomBiased() * 100) / 100,
    y: Math.round(randomBiased() * 100) / 100,
  };
}

async function main() {
  console.log('Starting image population...\n');

  // Load existing images
  let images = {};
  try {
    const data = await readFile(IMAGES_JSON_PATH, 'utf-8');
    images = JSON.parse(data);
  } catch {
    // File doesn't exist or is empty
  }

  const total = imageConfigs.length;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < imageConfigs.length; i++) {
    const config = imageConfigs[i];
    console.log(`[${i + 1}/${total}] Processing ${config.id}...`);

    try {
      // Download from picsum
      const imageBuffer = await downloadImage(config);

      // Upload to Cloudflare
      console.log(`  Uploading to Cloudflare...`);
      const cfResult = await uploadToCloudflare(imageBuffer, `${config.id}.jpg`);

      // Save metadata
      images[config.id] = {
        cloudflareId: cfResult.cloudflareId,
        accountHash: cfResult.accountHash,
        focalPoint: generateRandomFocalPoint(),
        alt: `Placeholder image ${config.id} (${config.width}x${config.height})`,
        filename: `${config.id}.jpg`,
        width: config.width,
        height: config.height,
        uploadedAt: new Date().toISOString(),
      };

      console.log(`  Done: ${cfResult.cloudflareId}\n`);
      success++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`  ERROR: ${error.message}\n`);
      failed++;
    }
  }

  // Write images.json
  await writeFile(IMAGES_JSON_PATH, JSON.stringify(images, null, 2));

  console.log('\n========================================');
  console.log(`Complete! ${success} uploaded, ${failed} failed`);
  console.log(`Images saved to: ${IMAGES_JSON_PATH}`);
}

main().catch(console.error);
