// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the exported cover alone, at the size the query
// names. `layout`, `grade`, `caption`, `subtitle`, `photo` and `photo2` pick the
// scene; `size` (WxH) sets the cover canvas. window.__shotReady is set once
// the scene is painted, so headless Chromium can screenshot it.
export async function runShot(shot, query, api) {
  const { state, setPhotoSlot, redraw, canvas, SIZES } = api;
  const layout = query.get('layout') ?? 'poster';
  const grade = query.get('grade') ?? 'vice';
  const caption = query.get('caption') ?? 'Neon Shore';
  const subtitle = query.get('subtitle') ?? 'a night in the city';
  const sizeKey = query.get('size') ?? '1080x1080';
  const photoA = query.get('photo') ?? 'boulevard';
  const photoB = query.get('photo2') ?? 'pier';

  state.layout = layout;
  state.grade = grade;
  state.title = caption;
  state.subtitle = subtitle;
  document.getElementById('caption').value = caption;
  document.getElementById('subtitle').value = subtitle;
  document.querySelectorAll('#layouts .chip').forEach((el) => el.classList.toggle('active', el.dataset.layout === layout));
  document.querySelectorAll('#grades .chip').forEach((el) => el.classList.toggle('active', el.dataset.grade === grade));

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

  if (shot === 'cover') {
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
