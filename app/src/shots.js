import { GRADES, LAYOUTS } from './cover.js';

// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the exported cover alone, at the size the query
// names. `layout`, `grade`, `caption`, `subtitle`, `photo` and `photo2` pick the
// scene; `size` (WxH) sets the cover canvas. window.__shotReady is set once
// the scene is painted, so headless Chromium can screenshot it.
//
// The four shots in shots.json, in order:
//   1-cover.jpg  cover, 1920x1080 wide, Poster Grid + Vice Sunset, "Neon Shore"
//   2-editor.jpg editor, Poster Grid + Vice Sunset, "Neon Shore" (the app at work)
//   3-cover.jpg  cover, 1080x1350 portrait, Center Stage + Midnight Indigo,
//                "Ocean Drive After Dark" / "neon after midnight" (two-line title)
//   4-cover.jpg  cover, 1080x1080 square, Four Square + Golden Hour, "Sunset Heist"
export async function runShot(shot, query, api) {
  // An unknown ?shot= value falls back to the editor scene, so the app always
  // shows something and never a blank page. No ?shot= at all (a plain load)
  // is the editor too, and stays silent.
  const scene = shot === 'cover' ? 'cover' : 'editor';
  if (shot !== null && shot !== 'cover' && shot !== 'editor') {
    console.warn(`unknown ?shot=${shot}, showing the editor instead`);
  }
  const { state, setPhotoSlot, redraw, canvas, SIZES } = api;
  const layout = query.get('layout') ?? 'poster';
  const grade = query.get('grade') ?? 'vice';
  // Unknown layout/grade names fall back to the defaults, like an unknown
  // ?shot= falls back to the editor: a typo in the query must never blank
  // the scene (drawCover already defaults unknown keys, this keeps the
  // picker chips and state honest about what is actually shown).
  const safeLayout = LAYOUTS[layout] ? layout : 'poster';
  const safeGrade = GRADES[grade] ? grade : 'vice';
  if (safeLayout !== layout) console.warn(`unknown layout=${layout}, using poster instead`);
  if (safeGrade !== grade) console.warn(`unknown grade=${grade}, using vice instead`);
  const caption = query.get('caption') ?? 'Neon Shore';
  const subtitle = query.get('subtitle') ?? 'a night in the city';
  const sizeKey = query.get('size') ?? '1080x1080';
  const photoA = query.get('photo') ?? 'boulevard';
  const photoB = query.get('photo2') ?? 'pier';

  state.layout = safeLayout;
  state.grade = safeGrade;
  state.title = caption;
  state.subtitle = subtitle;
  document.getElementById('caption').value = caption;
  document.getElementById('subtitle').value = subtitle;
  document.querySelectorAll('#layouts .chip').forEach((el) => el.classList.toggle('active', el.dataset.layout === safeLayout));
  document.querySelectorAll('#grades .chip').forEach((el) => el.classList.toggle('active', el.dataset.grade === safeGrade));

  // Two sample photos, alternating across the panels. Aim each panel's crop at
  // the upper part of its photo, where faces usually are. The quad layout gets
  // two photos per side so its four panels still alternate.
  await setPhotoSlot(0, `samples/${photoA}.jpg`, `Sample: ${photoA}`);
  await setPhotoSlot(1, `samples/${photoB}.jpg`, `Sample: ${photoB}`);
  state.panels.forEach((p, i) => {
    p.photo = i % 2;
    p.zoom = 1;
    p.ox = 0.5;
    const img = state.photos[p.photo];
    // oy is the vertical anchor: 1 shows the top of the photo (faces), 0 the
    // bottom. Aim portrait photos at the face, square ones slightly high.
    p.oy = img && img.naturalHeight > img.naturalWidth ? 0.88 : 0.80;
  });

  if (scene === 'cover') {
    // The cover alone, full frame, at the requested export size.
    const size = SIZES[sizeKey] ?? SIZES['1080x1080'];
    state.size = sizeKey;
    document.body.classList.add('shot-cover');
    canvas.width = size.w;
    canvas.height = size.h;
    const { drawCover } = await import('./cover.js');
    drawCover(canvas.getContext('2d'), size.w, size.h, state);
  } else {
    state.size = '1080x1080';
    redraw();
  }
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
