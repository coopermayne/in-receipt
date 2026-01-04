# Architect Portfolio MVP Specification

## Overview

Build a static Astro site with a distinctive two-column/two-row portfolio layout. Mobile-first. The core interaction is scroll-snapping galleries that transition smoothly into project detail modals.

## Tech Stack

- **Astro** (latest, with View Transitions enabled)
- **Vanilla JS** for interactions
- **CSS scroll-snap** for navigation
- **Manual FLIP** for modal transitions (cross-browser)
- **No CSS framework** - write minimal custom CSS

## Mock Data Requirement

**This MVP must be fully functional with mock content on first build. Do not leave placeholders, TODOs, or empty fields.**

**Images:** Use `https://placecats.com/{width}/{height}` — vary dimensions per image for realism (e.g., 800x1000, 850x1100, 780x950).

Generate a complete `src/data/projects.json` with **6 projects** (3 per category), each fully populated:

```json
{
  "projects": [
    {
      "id": "cedar-house",
      "title": "Cedar House",
      "category": "residential",
      "thumbnail": "https://placecats.com/800/1000",
      "shortDescription": "A hillside residence nestled among native oaks.",
      "fullDescription": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nPellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.",
      "images": [
        "https://placecats.com/900/600",
        "https://placecats.com/800/600",
        "https://placecats.com/850/650",
        "https://placecats.com/920/580"
      ]
    }
  ]
}
```

**All 6 projects must include:**

- Unique `id` (kebab-case)
- `title`
- `category`: `"residential"` or `"commercial"`
- `thumbnail`: unique placecats URL (~800x1000 vertical orientation)
- `shortDescription`: 1 real sentence describing the project
- `fullDescription`: 2-3 paragraphs of lorem ipsum
- `images`: array of 3-4 unique placecats URLs (landscape orientation, ~900x600)

**Project titles to use:**

Category A — "Residential" (left column / top row):

1. Cedar House — A hillside residence nestled among native oaks
2. Glass Pavilion — Minimalist weekend retreat with panoramic views
3. Urban Infill — Three-story home on a narrow downtown lot

Category B — "Commercial" (right column / bottom row):

1. Market Hall — Adaptive reuse of a 1920s warehouse
2. Studio Campus — Creative offices organized around courtyards
3. Civic Library — Public reading rooms with filtered natural light

## Layout Specifications

### Mobile (< 768px) — Default

```
┌─────────────────────────┐
│ ←  [IMG 1]  [IMG 2]  → │  ← horizontal scroll-snap (Residential)
│     "Cedar House"       │  ← title overlays bottom of image
├─────────────────────────┤
│ ←  [IMG 1]  [IMG 2]  → │  ← horizontal scroll-snap (Commercial)
│     "Market Hall"       │
└─────────────────────────┘
```

- Each row is exactly 50vh
- Images fill the row, aspect-ratio maintained with object-fit: cover
- Title overlays image at bottom with subtle gradient scrim
- Horizontal scroll-snap with `scroll-snap-type: x mandatory`
- Touch swipe feels native
- Small dot indicators or subtle peek of next image to hint scrollability

### Desktop (≥ 768px)

```
┌─────────────┬─────────────┐
│   [IMAGE]   │    "Title"  │
│             │  description│
│  "Title"    ├─────────────┤
│  description│   [IMAGE]   │
│      ↕      │      ↕      │
│   scroll    │   scroll    │
└─────────────┴─────────────┘
```

- Two columns, each 50vw
- Each column scrolls independently (vertical scroll-snap)
- Left column: image top (60%), text bottom (40%)
- Right column: text top (40%), image bottom (60%)
- `scroll-snap-type: y mandatory` on each column
- `scroll-snap-stop: always` to prevent skip-scrolling
- `overscroll-behavior: contain` to isolate scroll contexts

## Modal Transition (Both Layouts)

### Opening

1. User clicks/taps image or title
2. Capture clicked image's bounding rect
3. Clone image, position fixed at original location
4. Animate clone to hero position (top of modal, full width)
5. Fade in modal backdrop and content simultaneously
6. Duration: 350ms, easing: `cubic-bezier(0.4, 0, 0.2, 1)`

### Modal Layout

```
┌─────────────────────────┐
│ [X]                     │  ← close button top right
├─────────────────────────┤
│                         │
│      [HERO IMAGE]       │  ← the image that transitioned in
│                         │
├─────────────────────────┤
│  Title                  │
│  Full description       │
│                         │
│  [Image] [Image]        │  ← additional project images, grid
│  [Image] [Image]        │
│                         │
└─────────────────────────┘
```

- Modal is full viewport, scrollable
- Click X or backdrop (above hero) to close
- Close reverses the animation (image returns to grid position)

### Closing

1. Fade out content
2. Animate hero image back to its original grid position
3. Remove modal
4. Duration: 300ms

## Preloading Strategy

1. **Initial load:** First image in each column/row, eager load
2. **Adjacent images:** Preload ±1 from current position via Intersection Observer
3. **On hover (desktop):** Preload that project's additional images
4. **On modal open:** Project images should already be preloading; if not, show skeleton/blur-up

## File Structure

```
/
├── src/
│   ├── pages/
│   │   └── index.astro
│   ├── components/
│   │   ├── Gallery.astro         # handles both layouts via CSS
│   │   ├── ProjectCard.astro     # single project in gallery
│   │   ├── ProjectModal.astro    # modal markup (hidden by default)
│   │   └── ScrollIndicator.astro # dots for mobile
│   ├── scripts/
│   │   ├── modal.ts              # FLIP open/close logic
│   │   └── preloader.ts          # intersection observer preloading
│   ├── styles/
│   │   └── global.css
│   └── data/
│       └── projects.json         # FULLY POPULATED, see above
├── public/
│   └── (empty for now, images external)
└── astro.config.mjs
```

## CSS Approach

- CSS custom properties for spacing, colors, timing
- Mobile styles default, desktop via `@media (min-width: 768px)`
- Minimal reset (box-sizing, margin: 0)
- System font stack for speed
- Keep total CSS under 300 lines for MVP

## JavaScript Approach

- No build-time framework overhead
- Two small modules: `modal.ts` (~80 lines), `preloader.ts` (~40 lines)
- Use `data-` attributes to connect elements
- Event delegation on gallery containers
- `requestAnimationFrame` for FLIP animations

## Key CSS Snippets to Implement

```css
/* Scroll snapping */
.gallery-column {
  scroll-snap-type: y mandatory;
  overscroll-behavior: contain;
}

.gallery-row {
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.project-card {
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

/* Modal backdrop */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.95);
  opacity: 0;
  transition: opacity 300ms ease;
}

.modal-backdrop.open {
  opacity: 1;
}

/* FLIP image (positioned via JS) */
.flip-image {
  position: fixed;
  will-change: transform;
  z-index: 1000;
}
```

## Acceptance Criteria

- [ ] Site builds and runs with `npm run dev` on first clone — no setup required
- [ ] All 6 projects render with cat images and lorem ipsum text
- [ ] Mobile: two horizontal-scrolling rows work with touch swipe
- [ ] Mobile: scroll snaps crisply to each project
- [ ] Desktop: two vertical-scrolling columns work with mouse/trackpad
- [ ] Desktop: columns scroll independently
- [ ] Clicking any project opens modal with smooth FLIP animation
- [ ] Modal displays hero image + additional images + full description
- [ ] Closing modal animates image back to original position
- [ ] Works in Safari, Chrome, Firefox
- [ ] No jank on scroll or transitions (test at 4x CPU slowdown in DevTools)
- [ ] Images preload ahead of scroll position

## Stretch (Not MVP, but keep architecture ready)

- Real project content from markdown files
- Keyboard navigation (arrow keys to scroll, Escape to close modal)
- URL hash updates for direct linking to projects
- Page transition when navigating away (if we add other pages)
