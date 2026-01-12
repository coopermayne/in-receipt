import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types matching the database schema
export interface ImageRow {
  id: string;
  cloudflare_id: string;
  account_hash: string;
  focal_point_x: number;
  focal_point_y: number;
  alt: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
  uploaded_at: string;
}

export interface ProjectRow {
  id: string;
  title: string;
  category: 'residential' | 'commercial';
  thumbnail: string | null;
  short_description: string | null;
  full_description: string | null;
  year: string | null;
  location: string | null;
  type: string | null;
  images: string[];
  rank: number;
}

// Frontend format types
export interface ImageData {
  cloudflareId: string;
  accountHash: string;
  focalPoint: { x: number; y: number };
  alt: string;
  filename: string;
  width: number;
  height: number;
  uploadedAt: string;
}

export interface Project {
  id: string;
  title: string;
  category: 'residential' | 'commercial';
  thumbnail: string;
  shortDescription: string;
  fullDescription: string;
  year: string;
  location: string;
  type: string;
  images: string[];
  rank: number;
}

// Fetch all images from Supabase
export async function fetchImages(): Promise<Record<string, ImageData>> {
  const { data, error } = await supabase
    .from('images')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch images: ${error.message}`);
  }

  const images: Record<string, ImageData> = {};
  for (const row of data as ImageRow[]) {
    images[row.id] = {
      cloudflareId: row.cloudflare_id,
      accountHash: row.account_hash,
      focalPoint: {
        x: Number(row.focal_point_x),
        y: Number(row.focal_point_y),
      },
      alt: row.alt || '',
      filename: row.filename || '',
      width: row.width || 0,
      height: row.height || 0,
      uploadedAt: row.uploaded_at,
    };
  }

  return images;
}

// Fetch all projects from Supabase
export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('rank', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return (data as ProjectRow[]).map(row => ({
    id: row.id,
    title: row.title,
    category: row.category,
    thumbnail: row.thumbnail || '',
    shortDescription: row.short_description || '',
    fullDescription: row.full_description || '',
    year: row.year || '',
    location: row.location || '',
    type: row.type || '',
    images: row.images || [],
    rank: row.rank,
  }));
}
