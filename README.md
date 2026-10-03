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

## Testing

The tests build the site against a mock content API (`tests/support/`), so
they need no admin app, `.env` or real content. One-time setup after
`npm install`:

```bash
npx playwright install
```

Then:

```bash
npm test              # everything below except iOS Simulator
npm run test:desktop  # Chrome, Safari (WebKit) and Firefox at desktop size
npm run test:mobile   # emulated iPhone 15, iPhone SE and Pixel 7
npm run test:report   # open the HTML report from the last run
npx playwright test --ui   # watch tests run step by step
```

A failed test leaves a screenshot and a trace in `test-results/`;
`npm run test:report` shows both.

Playwright's WebKit is Safari's engine but not iOS Safari itself, so a bug
that only shows on a real iPhone can slip past it. For that, run the same
key mobile checks in Mobile Safari in the Xcode iOS Simulator:

```bash
safaridriver --enable   # one time, asks for your password
npm run test:ios        # IOS_DEVICE="iPhone 15" npm run test:ios to pick one
```

This needs Xcode with an iOS Simulator runtime installed. Run it before
merging anything that changes the mobile layout.

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