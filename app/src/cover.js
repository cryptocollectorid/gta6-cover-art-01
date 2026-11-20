// Neon Coast Cover Studio — the cover engine.
// Draws a GTA-poster-style multi-panel cover onto any 2D canvas context at any
// size: photo panels (each with its own photo, crop and position), a Vice City
// neon-sunset grade, a sunset title band with sun, skyline and palm silhouettes,
// and bold Anton title lettering with a Pacifico neon subtitle. Everything drawn
// here is the entrant's own art: no logos, no official artwork, no game fonts.

export const GRADES = {
  vice: { label: 'Vice Sunset', sat: 1.28, con: 1.06, wash: 'rgba(255,90,160,0.10)', top: 'rgba(255,170,60,0.12)', bottom: 'rgba(120,20,140,0.22)' },
  neon: { label: 'Neon Nights', sat: 1.35, con: 1.08, wash: 'rgba(0,229,255,0.08)', top: 'rgba(255,0,128,0.16)', bottom: 'rgba(0,40,120,0.28)' },
  gold: { label: 'Golden Hour', sat: 1.20, con: 1.05, wash: 'rgba(255,180,60,0.12)', top: 'rgba(255,200,90,0.10)', bottom: 'rgba(160,60,10,0.18)' },
  noir: { label: 'Teal Noir', sat: 0.85, con: 1.12, wash: 'rgba(0,180,180,0.10)', top: 'rgba(0,60,80,0.14)', bottom: 'rgba(0,0,0,0.30)' },
  candy: { label: 'Candy Pop', sat: 1.50, con: 1.04, wash: 'rgba(255,0,110,0.12)', top: 'rgba(255,120,200,0.14)', bottom: 'rgba(90,0,160,0.20)' },
  miami: { label: 'Miami Pink', sat: 1.45, con: 1.07, wash: 'rgba(255,0,180,0.12)', top: 'rgba(255,80,200,0.16)', bottom: 'rgba(0,180,220,0.24)' },
  midnight: { label: 'Midnight Indigo', sat: 0.95, con: 1.10, wash: 'rgba(90,40,200,0.10)', top: 'rgba(120,80,255,0.14)', bottom: 'rgba(8,0,40,0.30)' },
};

export const LAYOUTS = {
  poster: { label: 'Poster Grid', panels: 6 },
  hero: { label: 'Hero + Two', panels: 3 },
  strips: { label: 'Tilted Strips', panels: 3 },
  quad: { label: 'Four Square', panels: 4 },
  center: { label: 'Center Stage', panels: 3 },
  full: { label: 'Full Bleed', panels: 1 },
};

const PANEL_CELLS = {
  poster: [
    [0, 0, 0.585, 0.62], [0.585, 0, 0.415, 0.30], [0.585, 0.30, 0.415, 0.32],
    [0, 0.62, 0.32, 0.38], [0.32, 0.62, 0.34, 0.38], [0.66, 0.62, 0.34, 0.38],
  ],
  hero: [[0, 0, 0.64, 1], [0.64, 0, 0.36, 0.49], [0.64, 0.49, 0.36, 0.51]],
  strips: [
    [0.01, 0.01, 0.34, 0.98, -4], [0.335, 0.01, 0.34, 0.98, 3], [0.66, 0.01, 0.34, 0.98, -3],
  ],
  quad: [
    [0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5],
    [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5],
  ],
  center: [
    [0, 0, 1, 0.62],
    [0, 0.62, 0.5, 0.38], [0.5, 0.62, 0.5, 0.38],
  ],
  full: [[0, 0, 1, 1]],
};

/** Panel geometry for a layout at cover size W x H. Returns { panels, band } where
 *  band is the title-band rect (null for the full-bleed layout, whose title is an overlay). */
export function layoutPanels(layout, W, H) {
  const g = Math.max(4, Math.round(Math.min(W, H) * 0.012));
  const bandH = layout === 'full' ? 0 : Math.round(H * 0.24);
  const regionH = H - bandH;
  const cells = PANEL_CELLS[layout] ?? PANEL_CELLS.poster;
  const panels = cells.map(([fx, fy, fw, fh, rot = 0]) => ({
    x: Math.round(fx * W) + (fx > 0 ? g / 2 : 0),
    y: Math.round(fy * regionH) + (fy > 0 ? g / 2 : 0),
    w: Math.round(fw * W) - (fx > 0 ? g / 2 : 0) - (fx + fw < 1 ? g / 2 : 0),
    h: Math.round(fh * regionH) - (fy > 0 ? g / 2 : 0) - (fy + fh < 1 ? g / 2 : 0),
    rot,
  }));
  const band = bandH ? { x: 0, y: regionH, w: W, h: bandH } : null;
  return { panels, band, gutter: g };
}

/** A fresh per-panel crop state. photo is an index into state.photos, or -1 for empty. */
export function freshPanel(photo) {
  return { photo, zoom: 1, ox: 0.5, oy: 0.5, flip: false };
}

function fitSize(text, maxWidth, start, fontFor) {
  let size = start;
  while (size > 10) {
    if (fontFor(size).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

const GRAIN_TILE = 140;
const GRAIN_ALPHA = 26;
const GRAIN_OVERLAY_ALPHA = 0.45;
let noisePattern = null;
/** A reusable film-grain tile, built once per context. */
function grainPattern(ctx) {
  if (noisePattern) return noisePattern;
  const tile = document.createElement('canvas');
  tile.width = GRAIN_TILE; tile.height = GRAIN_TILE;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = GRAIN_ALPHA;
  }
  tctx.putImageData(img, 0, 0);
  noisePattern = ctx.createPattern(tile, 'repeat');
  return noisePattern;
}

/** Draws one photo panel: cover-fit with the crop state's zoom/pan/flip, then the grade.
 *  `panel` is the geometry from layoutPanels; `crop` is the per-panel crop state.
 *  `raw` skips the grade entirely (the compare view): the photo as it was taken. */
export function drawPhotoPanel(ctx, panel, photo, grade, crop, raw = false) {
  const { x, y, w, h } = panel;
  const zoom = crop?.zoom ?? 1;
  const oxF = crop?.ox ?? 0.5;
  const oyF = crop?.oy ?? 0.5;
  const flip = crop?.flip ?? false;
  ctx.save();
  ctx.beginPath();
  if (panel.rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((panel.rot * Math.PI) / 180);
    ctx.rect(-w / 2, -h / 2, w, h);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.clip();
  const ox = panel.rot ? -w / 2 : x;
  const oy = panel.rot ? -h / 2 : y;
  if (photo) {
    const base = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
    const iw = photo.naturalWidth * base * zoom;
    const ih = photo.naturalHeight * base * zoom;
    const dx = ox + (w - iw) * (1 - oxF);
    const dy = oy + (h - ih) * (1 - oyF);
    if (!raw) ctx.filter = `saturate(${grade.sat}) contrast(${grade.con})`;
    if (flip) {
      ctx.translate(ox + w / 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(photo, ox + w / 2 - dx - iw, dy, iw, ih);
    } else {
      ctx.drawImage(photo, dx, dy, iw, ih);
    }
    ctx.filter = 'none';
  } else {
    const ph = ctx.createLinearGradient(ox, oy, ox, oy + h);
    ph.addColorStop(0, '#3a2350');
    ph.addColorStop(1, '#160a24');
    ctx.fillStyle = ph;
    ctx.fillRect(ox, oy, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `bold ${Math.round(Math.min(w, h) * 0.16)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+ PHOTO', ox + w / 2, oy + h / 2);
  }
  ctx.globalCompositeOperation = 'overlay';
  if (!raw) {
    ctx.fillStyle = grade.wash;
    ctx.fillRect(ox, oy, w, h);
    const wash = ctx.createLinearGradient(ox, oy, ox, oy + h);
    wash.addColorStop(0, grade.top);
    wash.addColorStop(1, grade.bottom);
    ctx.fillStyle = wash;
    ctx.fillRect(ox, oy, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/** A stylised palm silhouette, trunk plus five fronds, drawn at (x, y) scaled by s. */
function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(8, -42, 16, -64);
  ctx.stroke();
  ctx.lineWidth = 4.5;
  const tips = [[-42, -78], [-24, -92], [2, -96], [28, -90], [46, -74]];
  for (const [tx, ty] of tips) {
    ctx.beginPath();
    ctx.moveTo(16, -64);
    ctx.quadraticCurveTo(16 + tx * 0.55, -64 + (ty + 64) * 0.4 - 14, 16 + tx, -64 + (ty + 64) * 0.55 + 12);
    ctx.stroke();
  }
  ctx.restore();
}

/** The sunset title band: gradient sky, striped synthwave sun, skyline, palms. */
function drawTitleBand(ctx, band) {
  const { x, y, w, h } = band;
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#ff9a3d');
  sky.addColorStop(0.45, '#ff2e88');
  sky.addColorStop(1, '#5b2a86');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // Striped sun, low on the right.
  const sunR = h * 0.34;
  const sunX = x + w * 0.82;
  const sunY = y + h * 0.46;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  const sun = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
  sun.addColorStop(0, '#fff3c4');
  sun.addColorStop(1, '#ff7a3d');
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = '#ff2e88';
  let stripeY = sunY + sunR * 0.05;
  let stripeH = sunR * 0.07;
  while (stripeY < sunY + sunR) {
    ctx.fillRect(sunX - sunR, stripeY, sunR * 2, stripeH);
    stripeY += stripeH * 2.6;
    stripeH *= 1.25;
  }
  ctx.restore();

  // Skyline silhouette along the bottom, in front of the sun's base.
  ctx.fillStyle = 'rgba(24, 8, 44, 0.92)';
  let bx = x;
  const heights = [0.34, 0.52, 0.28, 0.62, 0.4, 0.7, 0.46, 0.3, 0.58, 0.36, 0.5, 0.26];
  let i = 0;
  while (bx < x + w) {
    const bw = w * (0.05 + ((i * 37) % 10) / 220);
    const bh = h * heights[i % heights.length];
    ctx.fillRect(bx, y + h - bh, bw, bh);
    bx += bw + w * 0.008;
    i++;
  }
  drawPalm(ctx, x + w * 0.68, y + h * 0.99, h / 105, 'rgba(24, 8, 44, 0.95)');
  drawPalm(ctx, x + w * 0.745, y + h * 1.0, h / 150, 'rgba(24, 8, 44, 0.95)');
}

/** Splits a title into two lines at the word boundary that best balances their
 *  widths. Returns null when the title has no useful split point. */
function splitTitle(words, maxW, fontFor) {
  const parts = words.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  let best = null;
  for (let cut = 1; cut < parts.length; cut++) {
    const a = parts.slice(0, cut).join(' ');
    const b = parts.slice(cut).join(' ');
    const imbalance = Math.abs(fontFor(a).width - fontFor(b).width);
    if (!best || imbalance < best.imbalance) best = { lines: [a, b], imbalance };
  }
  return best?.lines ?? null;
}

/** Draws one title line with a warm gradient fill, a dark outline and a soft
 *  magenta glow, at the given baseline. */
function drawTitleLine(ctx, text, x, baseline, size) {
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  const grad = ctx.createLinearGradient(0, baseline - size, 0, baseline);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#ffe9a8');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a0b2e';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.shadowColor = 'rgba(255,46,136,0.55)';
  ctx.shadowBlur = size * 0.10;
  ctx.shadowOffsetY = size * 0.03;
  ctx.strokeText(text, x, baseline);
  ctx.fillStyle = grad;
  ctx.fillText(text, x, baseline);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** The title lettering: kicker, Anton title, Pacifico subtitle. A title that
 *  would shrink too small on one line wraps onto two balanced lines instead,
 *  so long captions stay big and readable. The two-line layout moves the
 *  kicker up and the subtitle down so nothing overlaps. */
function drawTitleText(ctx, rect, title, subtitle) {
  const { x, y, w, h } = rect;
  const cx = x + w * 0.06;
  const maxW = w * 0.60;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const words = (title.trim() || 'Neon Shore').toUpperCase();
  const measure = (text, s) => {
    ctx.font = `${s}px Anton, 'Arial Narrow', sans-serif`;
    return ctx.measureText(text);
  };
  const oneLine = fitSize(words, maxW, h * 0.46, (s) => measure(words, s));
  const lines = oneLine < h * 0.30
    ? splitTitle(words, maxW, (t) => measure(t, h * 0.34))
    : null;
  const twoLineSize = lines ? Math.min(
    fitSize(lines[0], maxW, h * 0.34, (s) => measure(lines[0], s)),
    fitSize(lines[1], maxW, h * 0.34, (s) => measure(lines[1], s)),
  ) : 0;
  const twoLine = lines && twoLineSize >= h * 0.20;

  // Kicker, tracked out with real letter-spacing (falls back to plain text
  // where the canvas does not support it).
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const kickSize = Math.max(12, h * 0.085);
  ctx.font = `700 ${kickSize}px system-ui, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(2, h * 0.02)}px`; } catch { /* older canvas: plain */ }
  ctx.fillText('NEON COAST PRESENTS', cx, y + h * (twoLine ? 0.13 : 0.17));
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }

  if (twoLine) {
    drawTitleLine(ctx, lines[0], cx, y + h * 0.46, twoLineSize);
    drawTitleLine(ctx, lines[1], cx, y + h * 0.74, twoLineSize);
    drawSubtitle(ctx, cx, y + h * 0.94, h * 0.13, subtitle);
  } else {
    drawTitleLine(ctx, words, cx, y + h * 0.62, oneLine);
    drawSubtitle(ctx, cx, y + h * 0.86, h * 0.17, subtitle);
  }
}

/** The Pacifico subtitle, tilted a touch, glowing neon yellow. */
function drawSubtitle(ctx, x, baseline, size, subtitle) {
  const sub = (subtitle.trim() || 'a night in the city');
  const subSize = Math.max(12, size);
  ctx.save();
  ctx.translate(x + 4, baseline);
  ctx.rotate(-0.02);
  ctx.font = `${subSize}px Pacifico, cursive`;
  ctx.shadowColor = '#ff71ce';
  ctx.shadowBlur = subSize * 0.45;
  ctx.fillStyle = '#ffd319';
  ctx.fillText(sub, 0, 0);
  ctx.restore();
}

/** Draws the whole cover for `state` onto ctx at size W x H. */
export function drawCover(ctx, W, H, state) {
  const grade = GRADES[state.grade] ?? GRADES.vice;
  const { panels, band } = layoutPanels(state.layout, W, H);

  // Cream poster stock, then the panels.
  ctx.fillStyle = '#f7f1e6';
  ctx.fillRect(0, 0, W, H);
  panels.forEach((panel, i) => {
    const pstate = state.panels[i] ?? freshPanel(i % Math.max(1, state.photos.length));
    const photo = pstate.photo >= 0 ? state.photos[pstate.photo] ?? null : null;
    drawPhotoPanel(ctx, panel, photo, grade, pstate, state.compare === true);
  });

  if (band) {
    drawTitleBand(ctx, band);
    drawTitleText(ctx, band, state.title, state.subtitle);
  } else {
    // Full bleed: scrim the foot, then letter over the photo.
    const scrim = ctx.createLinearGradient(0, H * 0.6, 0, H);
    scrim.addColorStop(0, 'rgba(24,8,44,0)');
    scrim.addColorStop(1, 'rgba(24,8,44,0.88)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);
    drawTitleText(ctx, { x: 0, y: H * 0.72, w: W, h: H * 0.26 }, state.title, state.subtitle);
  }

  // Film grain + vignette over everything, then the poster frame.
  const grain = grainPattern(ctx);
  if (grain) {
    ctx.save();
    ctx.globalAlpha = GRAIN_OVERLAY_ALPHA;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,4,24,0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#f7f1e6';
  ctx.lineWidth = Math.max(6, Math.min(W, H) * 0.012);
  ctx.strokeRect(0, 0, W, H);
}
