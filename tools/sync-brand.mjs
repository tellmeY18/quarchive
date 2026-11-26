// Vendors the letsimpl.fyi brand (the source of truth for all branding) into
// brand/. Never edit files in brand/ by hand: run `npm run brand` instead.
// `npm run brand -- --check` fails if the vendored copy is out of date.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

const BASE = 'https://brand.letsimpl.fyi';
const FILES = [
  'tokens/tokens.css', 'css/base.css', 'css/components.css',
  'fonts/atkinson-hyperlegible-mono-latin.woff2', 'fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2',
  'fonts/courier-prime-400-latin.woff2', 'fonts/courier-prime-700-latin.woff2', 'fonts/noto-serif-malayalam.woff2',
  'fonts/Atkinson-Hyperlegible-Mono.OFL.txt', 'fonts/Atkinson-Hyperlegible-Next.OFL.txt',
  'fonts/Courier-Prime.OFL.txt', 'fonts/Noto-Serif-Malayalam.OFL.txt',
];
const check = process.argv.includes('--check');
const out = new URL('../brand/', import.meta.url);
const get = async path => {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};
const sha = buf => createHash('sha256').update(buf).digest('hex');

const tokens = JSON.parse((await get('tokens/tokens.json')).toString());
const files = {};
let stale = [];
for (const path of FILES) {
  const buf = await get(path);
  files[path] = sha(buf);
  const target = new URL(path, out);
  if (check) {
    const local = await readFile(target).catch(() => null);
    if (!local || sha(local) !== files[path]) stale.push(path);
  } else {
    await mkdir(dirname(target.pathname), { recursive: true });
    await writeFile(target, buf);
  }
}
if (check) {
  if (stale.length) { console.error(`brand/ is out of date: ${stale.join(', ')}. Run: npm run brand`); process.exit(1); }
  console.log(`brand/ matches ${BASE} (tokens ${tokens.$meta.version})`); process.exit(0);
}
await writeFile(new URL('brand.json', out), JSON.stringify({ source: BASE, tokensVersion: tokens.$meta.version, files }, null, 2) + '\n');
console.log(`Synced ${FILES.length} files from ${BASE} (tokens ${tokens.$meta.version})`);
