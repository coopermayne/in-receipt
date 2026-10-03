// Stand-in for the admin app's content API, so the site can be built and
// tested without real content. Serves /api/content and a placeholder image
// for every /img/... URL.
import http from 'node:http';
import zlib from 'node:zlib';

const IMAGE_SIZES = [
  [1600, 1200], // landscape
  [1200, 1600], // portrait
  [1600, 900],
  [1000, 1000],
];

const images = {};
for (let i = 0; i < 12; i++) {
  const [width, height] = IMAGE_SIZES[i % IMAGE_SIZES.length];
  images[`img${i}`] = {
    ext: 'jpg',
    width,
    height,
    alt: `Test image ${i}`,
    filename: `img${i}.jpg`,
    focalPoint: { x: 0.5, y: 0.5 },
    uploadedAt: '2026-01-01T00:00:00Z',
    thumbhash: '',
  };
}

export const projects = [
  ['big', 'Hillside House'],
  ['big', 'Courtyard Library'],
  ['big', 'Harbor Pavilion'],
  ['small', 'Garden Stair'],
  ['small', 'Reading Nook'],
  ['small', 'Kiosk'],
].map(([category, title], i) => ({
  id: `p${i}`,
  title,
  category,
  rank: i,
  thumbnail: `img${i}`,
  shortDescription: `Short description of ${title}`,
  fullDescription: `Full description of ${title}. `.repeat(30).trim(),
  year: String(2020 + i),
  location: 'Los Angeles',
  type: category === 'big' ? 'Building' : 'Object',
  images: [`img${i + 6}`, `img${(i + 7) % 12}`, `img${(i + 8) % 12}`],
}));

// Solid gray PNG, served for every image request
function png(width, height) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0xb0)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const placeholder = png(40, 30);

export function startMockApi(port) {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/content')) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ images, projects }));
    } else if (req.url.startsWith('/img/')) {
      res.setHeader('content-type', 'image/png');
      res.end(placeholder);
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
