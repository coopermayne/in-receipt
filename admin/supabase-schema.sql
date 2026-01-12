-- Supabase Schema for in-receipt Admin
-- Run this in your Supabase SQL Editor

-- Images table
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  cloudflare_id TEXT NOT NULL,
  account_hash TEXT NOT NULL,
  focal_point_x DECIMAL(5,4) DEFAULT 0.5,
  focal_point_y DECIMAL(5,4) DEFAULT 0.5,
  alt TEXT,
  filename TEXT,
  width INTEGER,
  height INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('big', 'small')),
  thumbnail TEXT REFERENCES images(id) ON DELETE SET NULL,
  short_description TEXT,
  full_description TEXT,
  year TEXT,
  location TEXT,
  type TEXT,
  images TEXT[] DEFAULT '{}',
  rank INTEGER DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Public read access for images (needed for Astro build)
CREATE POLICY "Public read access for images"
  ON images FOR SELECT
  USING (true);

-- Public read access for projects (needed for Astro build)
CREATE POLICY "Public read access for projects"
  ON projects FOR SELECT
  USING (true);

-- Service role has full access (for admin operations)
-- Note: Service role bypasses RLS by default, so no explicit policy needed

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_rank ON projects(rank);
