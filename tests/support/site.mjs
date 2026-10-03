// Builds the site against the mock content API and serves it with
// `astro preview`. Used by Playwright (as its webServer) and by the iOS
// Simulator script. Run directly to serve the test site by hand:
//   node tests/support/site.mjs
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startMockApi } from './mock-api.mjs';

export const MOCK_PORT = 4998;
// Not 4321, so a running `npm run dev` is never mistaken for the test site
export const SITE_PORT = 4400;
export const SITE_URL = `http://localhost:${SITE_PORT}`;

const astro = fileURLToPath(new URL('../../node_modules/.bin/astro', import.meta.url));
const env = { ...process.env, CONTENT_API_URL: `http://localhost:${MOCK_PORT}` };

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(astro, args, { env, stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`astro ${args[0]} exited ${code}`))));
  });
}

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export async function startSite() {
  const api = await startMockApi(MOCK_PORT);
  await run(['build']);
  const preview = spawn(astro, ['preview', '--port', String(SITE_PORT)], { env, stdio: 'inherit' });
  await waitFor(SITE_URL);
  return () => {
    preview.kill();
    api.close();
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const stop = await startSite();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      stop();
      process.exit(0);
    });
  }
}
