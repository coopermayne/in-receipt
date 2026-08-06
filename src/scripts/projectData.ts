// Client-side access to the per-project JSON blobs Gallery.astro emits
// (one <script type="application/json" data-project-json="<id>"> per project).

export interface ResponsiveImage {
  id: string;
  src: string;
  srcset: string;
  sizes: string;
  alt: string;
}

export interface ProjectData {
  description: string;
  year?: string;
  location?: string;
  type?: string;
  leftPanelImages: ResponsiveImage[];
  rightPanelImages: ResponsiveImage[];
}

export function getProjectData(id: string): ProjectData | null {
  const el = document.querySelector(
    `script[type="application/json"][data-project-json="${CSS.escape(id)}"]`
  );
  if (!el?.textContent) return null;

  try {
    return JSON.parse(el.textContent) as ProjectData;
  } catch {
    return null;
  }
}
