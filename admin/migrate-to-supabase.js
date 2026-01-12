/**
 * Migration script: JSON files → Supabase
 *
 * Run this once after creating the Supabase tables to migrate existing data.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node migrate-to-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths to JSON files
const IMAGES_JSON_PATH = join(__dirname, '../src/data/images.json');
const PROJECTS_JSON_PATH = join(__dirname, '../src/data/projects.json');

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateImages() {
  console.log('Migrating images...');

  const data = await readFile(IMAGES_JSON_PATH, 'utf-8');
  const images = JSON.parse(data);

  const rows = Object.entries(images).map(([id, img]) => ({
    id,
    cloudflare_id: img.cloudflareId,
    account_hash: img.accountHash,
    focal_point_x: img.focalPoint?.x ?? 0.5,
    focal_point_y: img.focalPoint?.y ?? 0.5,
    alt: img.alt || null,
    filename: img.filename || null,
    width: img.width || null,
    height: img.height || null,
    uploaded_at: img.uploadedAt || new Date().toISOString(),
  }));

  console.log(`Found ${rows.length} images to migrate`);

  // Insert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('images')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`Error inserting images batch ${i / batchSize + 1}:`, error);
      throw error;
    }
    console.log(`Inserted images batch ${i / batchSize + 1}/${Math.ceil(rows.length / batchSize)}`);
  }

  console.log('Images migration complete!');
}

async function migrateProjects() {
  console.log('Migrating projects...');

  const data = await readFile(PROJECTS_JSON_PATH, 'utf-8');
  const { projects } = JSON.parse(data);

  const rows = projects.map(p => ({
    id: p.id,
    title: p.title,
    category: p.category,
    thumbnail: p.thumbnail || null,
    short_description: p.shortDescription || null,
    full_description: p.fullDescription || null,
    year: p.year || null,
    location: p.location || null,
    type: p.type || null,
    images: p.images || [],
    rank: p.rank ?? 0,
  }));

  console.log(`Found ${rows.length} projects to migrate`);

  // Insert all at once (usually fewer projects than images)
  const { error } = await supabase
    .from('projects')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('Error inserting projects:', error);
    throw error;
  }

  console.log('Projects migration complete!');
}

async function main() {
  console.log('Starting migration to Supabase...\n');

  try {
    await migrateImages();
    console.log('');
    await migrateProjects();
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  }
}

main();
