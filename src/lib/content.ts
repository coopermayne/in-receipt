// Content is fetched at build time from the self-hosted admin API.
// CONTENT_API_URL is the origin of the admin app (no trailing slash),
// e.g. https://admin.example.com — set it in the environment, never in source.

const contentApiUrl = import.meta.env.CONTENT_API_URL;

if (!contentApiUrl) {
  throw new Error('Missing CONTENT_API_URL environment variable');
}

const baseUrl = contentApiUrl.replace(/\/$/, '');

// Where /img/... is served from. Defaults to the content API's own origin,
// which is the normal setup; override only if images sit behind a different
// hostname than the admin app.
export const MEDIA_BASE_URL = (
  import.meta.env.MEDIA_BASE_URL || contentApiUrl
).replace(/\/$/, '');

export interface ImageData {
  // Extension of the stored original, e.g. 'jpg'. URLs are built from the
  // image id, not this — it is here for completeness.
  ext: string;
  focalPoint: { x: number; y: number };
  alt: string;
  filename: string;
  width: number;
  height: number;
  uploadedAt: string;
  // Base64 ThumbHash, decoded client-side into a blurred placeholder.
  // Empty until the admin has computed one.
  thumbhash: string;
}

export interface Project {
  id: string;
  title: string;
  category: 'big' | 'small';
  thumbnail: string;
  shortDescription: string;
  fullDescription: string;
  year: string;
  location: string;
  type: string;
  images: string[];
  rank: number;
}

interface ContentPayload {
  images: Record<string, Partial<ImageData>>;
  projects: Array<Partial<Project>>;
  // Absent from older admin versions; null until saved in the admin
  profile?: Partial<import('./profile').Profile> | null;
}

// One request serves the whole build; memoized so multiple callers share it.
let contentPromise: Promise<ContentPayload> | null = null;

function fetchContent(): Promise<ContentPayload> {
  if (!contentPromise) {
    contentPromise = (async () => {
      const response = await fetch(`${baseUrl}/api/content`);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch content from ${baseUrl}: ${response.status} ${response.statusText}`
        );
      }

      return response.json() as Promise<ContentPayload>;
    })();
  }

  return contentPromise;
}

// Nullable columns come back as null; the frontend expects empty strings/zeros.
function normalizeImage(image: Partial<ImageData>): ImageData {
  return {
    ext: image.ext || '',
    focalPoint: {
      x: Number(image.focalPoint?.x ?? 0.5),
      y: Number(image.focalPoint?.y ?? 0.5),
    },
    alt: image.alt || '',
    filename: image.filename || '',
    width: image.width || 0,
    height: image.height || 0,
    uploadedAt: image.uploadedAt || '',
    thumbhash: image.thumbhash || '',
  };
}

function normalizeProject(project: Partial<Project>): Project {
  return {
    id: project.id!,
    title: project.title!,
    category: project.category!,
    thumbnail: project.thumbnail || '',
    shortDescription: project.shortDescription || '',
    fullDescription: project.fullDescription || '',
    year: project.year || '',
    location: project.location || '',
    type: project.type || '',
    images: project.images || [],
    rank: project.rank ?? 0,
  };
}

export async function fetchImages(): Promise<Record<string, ImageData>> {
  const { images } = await fetchContent();

  const normalized: Record<string, ImageData> = {};
  for (const [id, image] of Object.entries(images)) {
    normalized[id] = normalizeImage(image);
  }

  return normalized;
}

export async function fetchProjects(): Promise<Project[]> {
  const { projects } = await fetchContent();
  return projects.map(normalizeProject);
}

export async function fetchContentProfile() {
  const { profile } = await fetchContent();
  return profile ?? null;
}
