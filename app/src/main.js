// Neon Coast Cover Studio — wires the page: photos, layout and grade pickers,
// title editing, per-panel crop (click to select, drag to pan, scroll to zoom)
// and PNG export in the three common post sizes. A `?shot=` query sets up a
// fixed scene for a screenshot instead (./shots.js).
import { GRADES, LAYOUTS, drawCover, freshPanel, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const SIZES = {
  '1080x1080': { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  '1080x1350': { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  '1920x1080': { label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
};

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const titleInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');

const state = {
  layout: 'poster',
  grade: 'vice',
  title: 'Neon Shore',
  subtitle: 'a night in the city',
  size: '1080x1080',
  photos: [null, null, null],
  photoNames: ['—', '—', '—'],
  panels: [freshPanel(0), freshPanel(1), freshPanel(0), freshPanel(1), freshPanel(0), freshPanel(1)],
};

// Debug handle for headless testing (also handy for the finalist review).
window.__neon = { state, drawCover };

let selectedPanel = 0;
let fontsReady = false;

function redraw() {
  const size = SIZES[state.size];
  const scale = Math.min(900 / size.w, 760 / size.h, 1);
  canvas.width = Math.round(size.w * scale);
  canvas.height = Math.round(size.h * scale);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCover(ctx, canvas.width, canvas.height, state);
  drawSelection(ctx);
}

/** The dashed outline of the selected panel, drawn over the preview. */
function drawSelection(ctx) {
  if (document.body.classList.contains('shot-cover')) return;
  const { panels } = layoutPanels(state.layout, canvas.width, canvas.height);
  const p = panels[selectedPanel];
  if (!p) return;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffd319';
  ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
  ctx.restore();
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function say(msg) {
  status.textContent = msg;
}

async function setPhotoSlot(slot, fileOrUrl, name) {
  const img = typeof fileOrUrl === 'string' ? await loadImage(fileOrUrl) : await loadImage(URL.createObjectURL(fileOrUrl));
  state.photos[slot] = img;
  state.photoNames[slot] = name;
  document.getElementById(`slot-name-${slot}`).textContent = name;
  // Panels pointing at an empty slot pick this one up; a first photo fills every panel.
  state.panels.forEach((p) => { if (p.photo < 0) p.photo = slot; });
  redraw();
  say(`Photo ${slot + 1} loaded — ${name}. Click a panel, then a photo, to place it.`);
}

// Photo slots: file picker + sample buttons.
for (let slot = 0; slot < 3; slot++) {
  document.getElementById(`photo-${slot}`).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { await setPhotoSlot(slot, file, file.name); } catch { say('That file could not be read as a photo.'); }
  });
  document.getElementById(`sample-${slot}`).addEventListener('click', async () => {
    const sample = slot === 2 ? 'pier' : slot === 1 ? 'boulevard' : 'boulevard';
    try { await setPhotoSlot(slot, `samples/${sample}.jpg`, `Sample: ${sample}`); } catch { say('Sample photo failed to load.'); }
  });
  document.getElementById(`slot-${slot}`).addEventListener('click', (e) => {
    if (e.target.closest('button,input,label')) return;
    assignPhotoToSelected(slot);
  });
}

/** Puts photo `slot` into the selected panel. */
function assignPhotoToSelected(slot) {
  const p = state.panels[selectedPanel];
  if (!p) return;
  p.photo = slot;
  p.zoom = 1; p.ox = 0.5; p.oy = 0.5;
  // Aim a portrait photo at the face when the panel is wider than it is tall.
  const img = state.photos[slot];
  const { panels } = layoutPanels(state.layout, canvas.width, canvas.height);
  const geo = panels[selectedPanel];
  if (img && geo && img.naturalHeight > img.naturalWidth && geo.w > geo.h) p.oy = 0.85;
  document.querySelectorAll('.slot').forEach((el, i) => el.classList.toggle('active', i === slot));
  redraw();
  say(`Photo ${slot + 1} placed in panel ${selectedPanel + 1}. Drag it to move, scroll to zoom.`);
}

// Layout + grade pickers.
const layoutRow = document.getElementById('layouts');
for (const [key, def] of Object.entries(LAYOUTS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.textContent = def.label;
  b.dataset.layout = key;
  b.addEventListener('click', () => {
    state.layout = key;
    layoutRow.querySelectorAll('.chip').forEach((el) => el.classList.toggle('active', el === b));
    selectedPanel = 0;
    redraw();
    say(`${def.label} layout — ${def.panels} panel${def.panels > 1 ? 's' : ''}.`);
  });
  layoutRow.appendChild(b);
}
layoutRow.querySelector('[data-layout="poster"]').classList.add('active');

const gradeRow = document.getElementById('grades');
for (const [key, def] of Object.entries(GRADES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.textContent = def.label;
  b.dataset.grade = key;
  b.addEventListener('click', () => {
    state.grade = key;
    gradeRow.querySelectorAll('.chip').forEach((el) => el.classList.toggle('active', el === b));
    redraw();
    say(`${def.label} grade applied.`);
  });
  gradeRow.appendChild(b);
}
gradeRow.querySelector('[data-grade="vice"]').classList.add('active');

// Title, subtitle, size.
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
document.getElementById('sizes').addEventListener('change', (e) => {
  state.size = e.target.value;
  redraw();
});

// Panel tools: zoom, flip, fill-all.
document.getElementById('zoom-in').addEventListener('click', () => zoomSelected(1.25));
document.getElementById('zoom-out').addEventListener('click', () => zoomSelected(0.8));
document.getElementById('flip').addEventListener('click', () => {
  const p = state.panels[selectedPanel];
  p.flip = !p.flip;
  redraw();
});
document.getElementById('fill-all').addEventListener('click', () => {
  const p = state.panels[selectedPanel];
  state.panels.forEach((q) => { q.photo = p.photo; });
  redraw();
  say(`All panels now use photo ${p.photo + 1}.`);
});
function zoomSelected(factor) {
  const p = state.panels[selectedPanel];
  p.zoom = Math.min(4, Math.max(1, p.zoom * factor));
  redraw();
}

// Pointer: click a panel to select it, drag to pan its photo, wheel to zoom it.
let dragging = null;
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = ((clientX - rect.left) / rect.width) * canvas.width;
  const py = ((clientY - rect.top) / rect.height) * canvas.height;
  const { panels } = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) return i;
  }
  return -1;
}
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selectedPanel = i;
  canvas.setPointerCapture(e.pointerId);
  dragging = { x: e.clientX, y: e.clientY, moved: false };
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const dx = (e.clientX - dragging.x) * (canvas.width / rect.width);
  const dy = (e.clientY - dragging.y) * (canvas.height / rect.height);
  if (Math.abs(e.clientX - dragging.x) + Math.abs(e.clientY - dragging.y) > 3) dragging.moved = true;
  const { panels } = layoutPanels(state.layout, canvas.width, canvas.height);
  const panel = panels[selectedPanel];
  const p = state.panels[selectedPanel];
  if (!panel || !p) return;
  const photo = state.photos[p.photo];
  if (!photo) return;
  const base = Math.max(panel.w / photo.naturalWidth, panel.h / photo.naturalHeight);
  const iw = photo.naturalWidth * base * p.zoom;
  const ih = photo.naturalHeight * base * p.zoom;
  if (iw > panel.w) p.ox = Math.min(1, Math.max(0, p.ox - dx / (iw - panel.w)));
  if (ih > panel.h) p.oy = Math.min(1, Math.max(0, p.oy - dy / (ih - panel.h)));
  dragging.x = e.clientX;
  dragging.y = e.clientY;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomSelected(e.deltaY < 0 ? 1.12 : 0.89);
}, { passive: false });

// Export: render the cover at full size on an offscreen canvas and download it.
function renderAt(size) {
  const out = document.createElement('canvas');
  out.width = size.w;
  out.height = size.h;
  drawCover(out.getContext('2d'), size.w, size.h, state);
  return out;
}
function download(canvasEl, name) {
  canvasEl.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}
document.getElementById('export').addEventListener('click', () => {
  const size = SIZES[state.size];
  download(renderAt(size), `neon-coast-${size.w}x${size.h}.png`);
  say(`Saved neon-coast-${size.w}x${size.h}.png — ${size.label}.`);
});
document.getElementById('export-all').addEventListener('click', () => {
  for (const size of Object.values(SIZES)) {
    download(renderAt(size), `neon-coast-${size.w}x${size.h}.png`);
  }
  say('Saved all three sizes: 1080 × 1080, 1080 × 1350 and 1920 × 1080.');
});

// Boot: wait for the vendored fonts, load the samples, then draw.
async function boot() {
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
    fontsReady = true;
  } catch { /* fall back to system fonts */ }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      state, setPhotoSlot, redraw, loadImage, canvas, SIZES,
    });
  } else {
    try {
      await setPhotoSlot(0, 'samples/boulevard.jpg', 'Sample: boulevard');
      await setPhotoSlot(1, 'samples/pier.jpg', 'Sample: pier');
    } catch { /* samples missing: the editor still works with uploads */ }
    redraw();
  }
  return fontsReady;
}
boot();
