# in-receipt

A profile page for Hallie built with Astro.

## Description

This is a modern web portfolio/profile page developed using the Astro framework.
Content and images come from the self-hosted admin app in `admin/`, which the
site reads at build time.

## Tech Stack

- [Astro](https://astro.build/) v5.0.0
- CSS
- TypeScript
- SQLite + sharp (admin backend)

## Getting Started

### Prerequisites

- Node.js installed on your machine

### Environment Variables

Building the site requires one variable:

- `CONTENT_API_URL` - Origin of the admin app, no trailing slash. The build
  fetches `<CONTENT_API_URL>/api/content` for all projects and images.

The admin app (`admin/`) has its own set — see `.env.example` for both.

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

The `/admin` folder contains the content backend: a small Express app that stores projects and images on the host and serves them to the site. See `admin/README.md`.

```bash
cd admin
npm install
npm start
```

Then open http://localhost:3001

See [admin/README.md](admin/README.md) for more details.

## License

This project is open source and available under the standard GitHub terms.