import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';

// All persistent state lives under DATA_DIR. In the container this is a mounted
// volume (/data); locally it defaults to ./data, which is gitignored.
export const DATA_DIR = process.env.DATA_DIR || resolve(process.cwd(), 'data');
export const DB_PATH = join(DATA_DIR, 'db', 'content.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============ MIGRATIONS ============
// Append-only. Each entry is applied once, tracked via PRAGMA user_version.
const MIGRATIONS = [
  // 1: initial schema, translated from the Supabase Postgres schema.
  // Differences: focal points are REAL (no DECIMAL), the projects.images
  // TEXT[] becomes a JSON array in a TEXT column, timestamps are ISO strings.
  // Images live on disk at $DATA_DIR/originals/<id>.<ext>; `ext` is the only
  // pointer needed, so there are no storage-provider columns.
  `
  CREATE TABLE images (
    id            TEXT PRIMARY KEY,
    ext           TEXT NOT NULL,
    focal_point_x REAL NOT NULL DEFAULT 0.5,
    focal_point_y REAL NOT NULL DEFAULT 0.5,
    alt           TEXT,
    filename      TEXT,
    width         INTEGER,
    height        INTEGER,
    uploaded_at   TEXT NOT NULL
  );

  CREATE TABLE projects (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    category          TEXT NOT NULL CHECK (category IN ('big', 'small')),
    thumbnail         TEXT REFERENCES images(id) ON DELETE SET NULL,
    short_description TEXT,
    full_description  TEXT,
    year              TEXT,
    location          TEXT,
    type              TEXT,
    images            TEXT NOT NULL DEFAULT '[]',
    rank              INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_projects_category ON projects(category);
  CREATE INDEX idx_projects_rank ON projects(rank);
  `,

  // 2: key/value meta table. Holds content_modified_at (stamped by every
  // content mutation) and last_published_at (stamped when a publish is
  // triggered); comparing the two answers "are there unpublished changes?".
  `
  CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

function migrate() {
  const applied = db.pragma('user_version', { simple: true });

  for (let version = applied; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version];
    db.transaction(() => {
      db.exec(sql);
      // Safe to interpolate: a loop index, never user input.
      db.pragma(`user_version = ${version + 1}`);
    })();
    console.log(`Applied migration ${version + 1}`);
  }
}

migrate();

// ============ META / PUBLISH STATE ============

const getMetaStmt = db.prepare('SELECT value FROM meta WHERE key = ?');
const setMetaStmt = db.prepare(`
  INSERT INTO meta (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

function getMeta(key) {
  return getMetaStmt.get(key)?.value ?? null;
}

function setMeta(key, value) {
  setMetaStmt.run(key, value);
}

// Called by every content mutation below. ISO strings compare correctly
// as strings, so no date parsing is needed anywhere.
function touchContent() {
  setMeta('content_modified_at', new Date().toISOString());
}

export function recordPublish() {
  setMeta('last_published_at', new Date().toISOString());
  // Snapshot what was published so the diff against it can answer
  // "what will the next publish change?". The payload is small (metadata
  // only, no binaries), so storing it whole beats event bookkeeping.
  setMeta('published_content', JSON.stringify(getContent()));
}

// Scalar project fields worth naming in the diff, with UI labels.
// rank is handled separately (reorders touch many rows at once).
const PROJECT_DIFF_FIELDS = [
  ['title', 'title'],
  ['category', 'category'],
  ['year', 'year'],
  ['location', 'location'],
  ['type', 'type'],
  ['shortDescription', 'short description'],
  ['fullDescription', 'full description'],
];

function diffProjectFields(before, after) {
  const fields = [];
  for (const [key, label] of PROJECT_DIFF_FIELDS) {
    if ((before[key] ?? null) !== (after[key] ?? null)) fields.push(label);
  }
  if ((before.thumbnail ?? null) !== (after.thumbnail ?? null)) {
    fields.push('starred image');
  }

  const beforeImgs = before.images || [];
  const afterImgs = after.images || [];
  const added = afterImgs.filter(id => !beforeImgs.includes(id)).length;
  const removed = beforeImgs.filter(id => !afterImgs.includes(id)).length;
  if (added || removed) {
    const parts = [];
    if (added) parts.push(`${added} added`);
    if (removed) parts.push(`${removed} removed`);
    fields.push(`images (${parts.join(', ')})`);
  } else if (beforeImgs.join('\n') !== afterImgs.join('\n')) {
    fields.push('images reordered');
  }

  return fields;
}

function diffImageFields(before, after) {
  const changes = [];
  if (before.uploadedAt !== after.uploadedAt || before.ext !== after.ext) {
    changes.push('file replaced');
  }
  if ((before.alt ?? null) !== (after.alt ?? null)) changes.push('alt text');
  if (
    before.focalPoint.x !== after.focalPoint.x ||
    before.focalPoint.y !== after.focalPoint.y
  ) {
    changes.push('focal point');
  }
  return changes;
}

// Rank-ordered project ids for one category, restricted to ids present in
// both snapshots so additions/deletions don't read as reorders.
function categoryOrder(projects, category, commonIds) {
  return projects
    .filter(p => p.category === category && commonIds.has(p.id))
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map(p => p.id)
    .join('\n');
}

// Compares current content against the snapshot taken at last publish.
// Derived from the actual data, so edits that cancel out show as no change.
export function getPublishDiff() {
  const raw = getMeta('published_content');
  if (!raw) return { available: false };

  const before = JSON.parse(raw);
  const after = getContent();

  const beforeById = new Map(before.projects.map(p => [p.id, p]));
  const afterById = new Map(after.projects.map(p => [p.id, p]));

  const projects = { added: [], deleted: [], modified: [], reordered: [] };
  for (const p of after.projects) {
    const prev = beforeById.get(p.id);
    if (!prev) {
      projects.added.push({ id: p.id, title: p.title });
    } else {
      const fields = diffProjectFields(prev, p);
      if (fields.length) projects.modified.push({ id: p.id, title: p.title, fields });
    }
  }
  for (const p of before.projects) {
    if (!afterById.has(p.id)) projects.deleted.push({ id: p.id, title: p.title });
  }

  const commonIds = new Set(
    after.projects.filter(p => beforeById.has(p.id)).map(p => p.id)
  );
  for (const category of ['big', 'small']) {
    const beforeOrder = categoryOrder(before.projects, category, commonIds);
    const afterOrder = categoryOrder(after.projects, category, commonIds);
    if (beforeOrder !== afterOrder) projects.reordered.push(category);
  }

  const images = { added: [], deleted: [], modified: [] };
  for (const [id, img] of Object.entries(after.images)) {
    const prev = before.images[id];
    if (!prev) {
      images.added.push(id);
    } else {
      const changes = diffImageFields(prev, img);
      if (changes.length) images.modified.push({ id, changes });
    }
  }
  for (const id of Object.keys(before.images)) {
    if (!(id in after.images)) images.deleted.push(id);
  }

  const clean =
    !projects.added.length && !projects.deleted.length &&
    !projects.modified.length && !projects.reordered.length &&
    !images.added.length && !images.deleted.length && !images.modified.length;

  return { available: true, clean, projects, images };
}

export function getPublishState() {
  const lastModifiedAt = getMeta('content_modified_at');
  const lastPublishedAt = getMeta('last_published_at');
  return {
    lastModifiedAt,
    lastPublishedAt,
    hasUnpublishedChanges:
      lastModifiedAt !== null &&
      (lastPublishedAt === null || lastModifiedAt > lastPublishedAt),
  };
}

// ============ ROW MAPPERS ============

function rowToImage(row) {
  return {
    ext: row.ext,
    focalPoint: {
      x: row.focal_point_x,
      y: row.focal_point_y,
    },
    alt: row.alt,
    filename: row.filename,
    width: row.width,
    height: row.height,
    uploadedAt: row.uploaded_at,
  };
}

function rowToProject(row) {
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
    images: JSON.parse(row.images),
    rank: row.rank,
  };
}

// ============ IMAGES ============

const selectImages = db.prepare('SELECT * FROM images');
const selectImage = db.prepare('SELECT * FROM images WHERE id = ?');
const deleteImageStmt = db.prepare('DELETE FROM images WHERE id = ?');
const upsertImageStmt = db.prepare(`
  INSERT INTO images (
    id, ext, focal_point_x, focal_point_y,
    alt, filename, width, height, uploaded_at
  ) VALUES (
    @id, @ext, @focal_point_x, @focal_point_y,
    @alt, @filename, @width, @height, @uploaded_at
  )
  ON CONFLICT(id) DO UPDATE SET
    ext           = excluded.ext,
    focal_point_x = excluded.focal_point_x,
    focal_point_y = excluded.focal_point_y,
    alt           = excluded.alt,
    filename      = excluded.filename,
    width         = excluded.width,
    height        = excluded.height,
    uploaded_at   = excluded.uploaded_at
`);

// Metadata-only edit: must not disturb the columns that describe the file
// on disk, since no new file was uploaded.
const updateImageMetaStmt = db.prepare(`
  UPDATE images SET
    focal_point_x = @focal_point_x,
    focal_point_y = @focal_point_y,
    alt           = @alt
  WHERE id = @id
`);

// Returns images keyed by id, matching the shape the frontend expects.
export function listImages() {
  const images = {};
  for (const row of selectImages.all()) {
    images[row.id] = rowToImage(row);
  }
  return images;
}

export function getImage(id) {
  const row = selectImage.get(id);
  return row ? rowToImage(row) : null;
}

// Called when a file is uploaded: writes every column.
export function upsertImage(id, data) {
  upsertImageStmt.run({
    id,
    ext: data.ext,
    focal_point_x: data.focalPoint?.x ?? 0.5,
    focal_point_y: data.focalPoint?.y ?? 0.5,
    alt: data.alt || null,
    filename: data.filename || null,
    width: data.width || null,
    height: data.height || null,
    uploaded_at: data.uploadedAt || new Date().toISOString(),
  });
  touchContent();
}

// Called when editing an existing image's alt text or focal point.
export function updateImageMeta(id, data) {
  const changed = updateImageMetaStmt.run({
    id,
    focal_point_x: data.focalPoint?.x ?? 0.5,
    focal_point_y: data.focalPoint?.y ?? 0.5,
    alt: data.alt || null,
  }).changes > 0;
  if (changed) touchContent();
  return changed;
}

export function deleteImage(id) {
  const changed = deleteImageStmt.run(id).changes > 0;
  if (changed) touchContent();
  return changed;
}

// ============ PROJECTS ============

const selectProjects = db.prepare('SELECT * FROM projects ORDER BY rank ASC');
const selectProject = db.prepare('SELECT * FROM projects WHERE id = ?');
const deleteProjectStmt = db.prepare('DELETE FROM projects WHERE id = ?');
const insertProjectStmt = db.prepare(`
  INSERT INTO projects (
    id, title, category, thumbnail, short_description, full_description,
    year, location, type, images, rank
  ) VALUES (
    @id, @title, @category, @thumbnail, @short_description, @full_description,
    @year, @location, @type, @images, @rank
  )
`);
const updateProjectStmt = db.prepare(`
  UPDATE projects SET
    title             = @title,
    category          = @category,
    thumbnail         = @thumbnail,
    short_description = @short_description,
    full_description  = @full_description,
    year              = @year,
    location          = @location,
    type              = @type,
    images            = @images,
    rank              = @rank
  WHERE id = @id
`);
const updateRankStmt = db.prepare(
  'UPDATE projects SET rank = ? WHERE id = ? AND category = ?'
);

function projectToRow(data) {
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
    images: JSON.stringify(data.images || []),
    rank: data.rank ?? 0,
  };
}

export function listProjects() {
  return selectProjects.all().map(rowToProject);
}

export function projectExists(id) {
  return selectProject.get(id) !== undefined;
}

export function insertProject(data) {
  insertProjectStmt.run(projectToRow(data));
  touchContent();
}

export function updateProject(id, data) {
  const changed = updateProjectStmt.run(projectToRow({ ...data, id })).changes;
  if (changed === 0) return null;
  touchContent();
  return rowToProject(selectProject.get(id));
}

export function deleteProject(id) {
  const changed = deleteProjectStmt.run(id).changes > 0;
  if (changed) touchContent();
  return changed;
}

// Rewrites rank to match the given order, scoped to one category.
export const reorderProjects = db.transaction((category, projectIds) => {
  projectIds.forEach((id, index) => updateRankStmt.run(index, id, category));
  touchContent();
});

// ============ PUBLIC CONTENT ============

// Everything the Astro build needs, in one request.
export function getContent() {
  return {
    images: listImages(),
    projects: listProjects(),
  };
}

export default db;
