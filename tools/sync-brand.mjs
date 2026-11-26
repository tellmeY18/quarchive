// Vendors the letsimpl.fyi brand (the source of truth for all branding) into
// brand/ and the Quarchive identity kit into icons/. Never edit these files by
// hand: run `npm run brand` instead. `npm run brand -- --check` fails on drift.
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
const ICONS = [
  'README.md', 'logo-primary.svg', 'logo-primary-inverse.svg', 'logo-mark.svg', 'logo-mark-inverse.svg',
  'logo-mono.svg', 'logo-mono-inverse.svg', 'favicon.svg', 'app-icon.svg', 'app-icon-192.png',
  'app-icon-512.png', 'apple-touch-icon-180.png', 'app-icon-maskable.svg', 'app-icon-maskable-512.png',
  'splash.svg', 'splash-1080x1920.png', 'loading.svg', 'loading-1080x1920.png', 'og-image.svg', 'og-image.png',
  'github-social.svg', 'github-social.png', 'avatar-400.png',
];
const check = process.argv.includes('--check');
const brandDir = new URL('../brand/', import.meta.url);
const iconsDir = new URL('../icons/', import.meta.url);
const get = async path => {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};
const sha = buf => createHash('sha256').update(buf).digest('hex');

const tokens = JSON.parse((await get('tokens/tokens.json')).toString());
const files = {};
const assets = {};
let stale = [];
const targets = [
  ...FILES.map(path => [path, path, new URL(path, brandDir), files]),
  ...ICONS.map(name => [`assets/quarchive/${name}`, name, new URL(name, iconsDir), assets]),
];
for (const [path, key, target, manifest] of targets) {
  const buf = await get(path);
  const hash = sha(buf);
  manifest[key] = hash;
  if (check) {
    const local = await readFile(target).catch(() => null);
    if (!local || sha(local) !== hash) stale.push(path);
  } else {
    await mkdir(dirname(target.pathname), { recursive: true });
    await writeFile(target, buf);
  }
}
if (check) {
  if (stale.length) { console.error(`vendored brand files are out of date: ${stale.join(', ')}. Run: npm run brand`); process.exit(1); }
  console.log(`brand/ and icons/ match ${BASE} (tokens ${tokens.$meta.version})`); process.exit(0);
}
await writeFile(new URL('brand.json', brandDir), JSON.stringify({ source: BASE, tokensVersion: tokens.$meta.version, files, assets }, null, 2) + '\n');
console.log(`Synced ${targets.length} files from ${BASE} (tokens ${tokens.$meta.version})`);
