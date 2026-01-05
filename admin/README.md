# IN RECEIPT - Image Admin

Simple admin tool for uploading and managing images with Cloudflare Images.

## Requirements

**Environment Variables** (required):
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - API token with Cloudflare Images permissions

In Codespaces, add these as repository secrets.

## Setup

```bash
cd admin
npm install
```

## Running

```bash
npm start
```

Then open http://localhost:3001

## Features

- **Upload images** - Drag & drop or browse to upload images to Cloudflare Images
- **Set focal point** - Click on the image to set the focal point for smart cropping
- **Crop preview** - See how the image will be cropped on mobile devices
- **Edit metadata** - Update alt text and focal point for existing images
- **Delete images** - Remove images from both Cloudflare and the library

## Data Structure

Images are stored in `src/data/images.json`:

```json
{
  "image-id": {
    "cloudflareId": "abc123-def456",
    "focalPoint": { "x": 0.5, "y": 0.3 },
    "alt": "Description of the image",
    "filename": "original-filename.jpg",
    "uploadedAt": "2024-01-05T..."
  }
}
```

## Using Images in Projects

Reference images by ID in `src/data/projects.json`:

```json
{
  "projects": [{
    "id": "project-1",
    "thumbnail": "image-id-here",
    "images": ["image-1", "image-2", "image-3"]
  }]
}
```

The frontend components will resolve these IDs to Cloudflare URLs and apply the focal point for CSS `object-position`.
