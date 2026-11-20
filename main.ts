// Neon Coast Cover Studio — the entry program (Node 22, standard library only).
// It hands the app in: it first checks the entry against the gate's own caps
// (3–4 screenshots, each at most 256 KiB; app/ at most 993 files and 48 MiB),
// then copies this directory's app/ (the offline cover maker: app/index.html
// and its ES modules, vendored fonts, no network request) and screenshots/ to
// /output, and writes /output/dossier.json with the vendored make.fun library.
// The app itself lives in app/src/cover.js (the cover engine) and
// app/src/main.js (the editor); the screenshots are the app's own renders,
// taken in headless Chromium from the ?shot= scenes in app/src/shots.js.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps (reference/gate.json), named once so the pre-flight below
// and the dossier call can never drift apart: 3–4 screenshots, each at most
// 256 KiB; app/ at most 993 files and 48 MiB; a path under app/ at most
// 1000 bytes.
const MIN_SHOTS = 3;
const MAX_SHOTS = 4;
const MAX_SHOT_BYTES = 256 * 1024;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 48 * 1024 * 1024;
const APP_PATH_MAX_BYTES = 1000;
// Only still images may be handed in as screenshots.
const SHOT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Walks a directory tree, returning [fileCount, totalBytes] of regular files. */
function treeSize(root) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const [f, b] = treeSize(path);
      files += f;
      bytes += b;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return [files, bytes];
}

// Pre-flight: refuse to hand in an entry the gate would refuse, with the
// reason printed instead of a silent bad dossier.
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing: take the 4 shots first');
const shots = readdirSync(shotsDir).filter((n) => !n.startsWith('.'));
if (shots.length < MIN_SHOTS || shots.length > MAX_SHOTS) throw new Error(`screenshots/ holds ${shots.length} images, need ${MIN_SHOTS} or ${MAX_SHOTS}`);
for (const name of shots) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(name) || name.startsWith('-')) throw new Error(`bad screenshot name: ${name}`);
  if (!SHOT_EXTENSIONS.has(name.slice(name.lastIndexOf('.')).toLowerCase())) throw new Error(`screenshot ${name} is not a still image (.jpg/.png/.webp)`);
  const size = statSync(join(shotsDir, name)).size;
  if (size > MAX_SHOT_BYTES) throw new Error(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
}
const shotBytes = shots.reduce((sum, name) => sum + statSync(join(shotsDir, name)).size, 0);
const [appFiles, appBytes] = treeSize(join(here, 'app'));
if (appFiles > APP_MAX_FILES) throw new Error(`app/ holds ${appFiles} files, over the ${APP_MAX_FILES} cap`);
if (appBytes > APP_MAX_BYTES) throw new Error(`app/ is ${appBytes} bytes, over the 48 MiB cap`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: MAX_SHOTS, max_bytes: MAX_SHOT_BYTES },
    app_max_files: APP_MAX_FILES,
    app_max_bytes: APP_MAX_BYTES,
    app_path_max_bytes: APP_PATH_MAX_BYTES,
  }),
);

console.log(`dossier written: app/ ${appFiles} files, ${appBytes} bytes; screenshots/ ${shots.length} files, ${shotBytes} bytes`);
