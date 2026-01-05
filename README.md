# in-receipt

A profile page for Hallie built with Astro.

## Description

This is a modern web portfolio/profile page developed using the Astro framework.

## Tech Stack

- [Astro](https://astro.build/) v5.0.0
- CSS
- TypeScript

## Getting Started

### Prerequisites

- Node.js installed on your machine

### Environment Variables (for Image Admin)

The image admin tool requires Cloudflare credentials:

- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - API token with Cloudflare Images permissions

In GitHub Codespaces, add these as repository secrets.

### Installation

1. Clone the repository
```bash
git clone https://github.com/coopermayne/in-receipt.git
cd in-receipt
```

2. Install dependencies
```bash
npm install
```

### Development

Run the development server:
```bash
npm run dev
```

### Build

Build the project for production:
```bash
npm run build
```

### Preview

Preview the production build:
```bash
npm run preview
```

## Image Admin Tool

The `/admin` folder contains a simple tool for uploading images to Cloudflare Images and setting focal points.

```bash
cd admin
npm install
npm start
```

Then open http://localhost:3001

See [admin/README.md](admin/README.md) for more details.

## License

This project is open source and available under the standard GitHub terms.