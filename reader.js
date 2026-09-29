// Floor 7 screenshot reader.
// Free, runs on your device (no AI): uses Tesseract to read the text on an MT5
// chart screenshot, then uses the colour of each price label to work out which
// one is the entry (blue), and which are the TP and SL (red).
const Reader = (() => {
  const LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let libp = null;

  function loadLib() {
    if (window.Tesseract) return Promise.resolve();
    if (libp) return libp;
    libp = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LIB; s.onload = resolve;
      s.onerror = () => { libp = null; reject(new Error('Could not load the reader. Check your internet connection.')); };
      document.head.appendChild(s);
    });
    return libp;
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('That file could not be opened as an image.'));
      img.src = dataUrl;
    });
  }

  // Returns { original, processed } canvases at the same size.
  function prepare(img) {
    const target = 1800; // work at a steady height for consistent reading
    const scale = Math.min(2, Math.max(0.6, target / img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const original = document.createElement('canvas');
    original.width = w; original.height = h;
    const octx = original.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0, w, h);

    const processed = document.createElement('canvas');
    processed.width = w; processed.height = h;
    const pctx = processed.getContext('2d');
    const data = octx.getImageData(0, 0, w, h);
    const px = data.data;
    // Work out if the screenshot is dark (MT5 dark mode) so we can flip it to dark text on white
    let sum = 0, n = 0;
    for (let i = 0; i < px.length; i += 400) { sum += px[i] + px[i + 1] + px[i + 2]; n++; }
    const dark = sum / n / 3 < 110;
    for (let i = 0; i < px.length; i += 4) {
      let g = Math.max(px[i], px[i + 1], px[i + 2]); // keeps coloured text visible
      if (dark) g = 255 - g;
      g = g < 150 ? Math.max(0, g - 60) : 255; // boost contrast
      px[i] = px[i + 1] = px[i + 2] = g;
    }
    pctx.putImageData(data, 0, 0);
    return { original, octx, processed };
  }

  function colourOf(octx, b) {
    const w = Math.max(1, b.x1 - b.x0), h = Math.max(1, b.y1 - b.y0);
    const d = octx.getImageData(b.x0, b.y0, w, h).data;
    let red = 0, blue = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], bl = d[i + 2];
      if (r > 120 && r > g * 1.6 && r > bl * 1.6) red++;
      else if (bl > 120 && bl > r * 1.4 && bl > g * 1.05) blue++;
    }
    const area = w * h;
    if (red / area > 0.04 && red >= blue) return 'red';
    if (blue / area > 0.04) return 'blue';
    return 'plain';
  }

  const PRICE = /^\d[.,]\d{4,5}$/;
  const num = (s) => parseFloat(String(s).replace(',', '.'));
  const midY = (b) => (b.y0 + b.y1) / 2;

  function parse(words, octx) {
    const out = { direction: null, lots: null, entry: null, sl: null, tp: null };
    const raw = words.map((w) => ({ text: w.text.replace(/[^\w.,-]/g, ''), bbox: { ...w.bbox } })).filter((w) => w.text);
    // Spaced-out digits can come back as separate pieces ("1.14" "734"): join them
    const clean = [];
    for (const w of raw) {
      const prev = clean[clean.length - 1];
      if (prev && /^\d[.,]?\d*$/.test(prev.text) && /^\d+$/.test(w.text) && !PRICE.test(prev.text)) {
        const sameRow = Math.abs(midY(prev.bbox) - midY(w.bbox)) < (prev.bbox.y1 - prev.bbox.y0) * 0.6;
        const gap = w.bbox.x0 - prev.bbox.x1;
        if (sameRow && gap >= 0 && gap < (prev.bbox.y1 - prev.bbox.y0) * 1.2) {
          prev.text += w.text;
          prev.bbox.x1 = w.bbox.x1;
          prev.bbox.y0 = Math.min(prev.bbox.y0, w.bbox.y0);
          prev.bbox.y1 = Math.max(prev.bbox.y1, w.bbox.y1);
          continue;
        }
      }
      clean.push(w);
    }

    // Direction and lot size, e.g. "BUY 0.7,"
    for (let i = 0; i < clean.length; i++) {
      const t = clean[i].text.toUpperCase();
      if (t === 'BUY' || t === 'SELL') {
        out.direction = t === 'BUY' ? 'buy' : 'sell';
        out._dirWord = clean[i];
        const next = clean[i + 1] && clean[i + 1].text.replace(/,$/, '');
        if (next && /^\d+([.,]\d+)?$/.test(next)) out.lots = num(next);
        break;
      }
    }

    // Price labels with their colour
    const prices = clean
      .filter((w) => PRICE.test(w.text.replace(/,$/, '')))
      .map((w) => ({ v: num(w.text.replace(/,$/, '')), bbox: w.bbox, colour: colourOf(octx, w.bbox) }));

    const findLabel = (label) => clean.find((w) => w.text.toUpperCase() === label);
    const nearestPrice = (word, pool) => {
      let best = null, dist = Infinity;
      for (const p of pool) {
        const d = Math.abs(midY(p.bbox) - midY(word.bbox));
        if (d < dist) { dist = d; best = p; }
      }
      const h = word.bbox.y1 - word.bbox.y0;
      return dist <= h * 1.5 ? best : null;
    };

    const coloured = prices.filter((p) => p.colour !== 'plain');
    const reds = prices.filter((p) => p.colour === 'red');
    const blues = prices.filter((p) => p.colour === 'blue');

    // Entry: the blue price box. Fallback: middle of the coloured prices.
    if (blues.length) out.entry = blues[0].v;

    // TP and SL: match the "TP" / "SL" labels to the red price on the same row.
    const tpW = findLabel('TP'), slW = findLabel('SL');
    if (tpW) { const p = nearestPrice(tpW, reds.length ? reds : prices); if (p) out.tp = p.v; }
    if (slW) { const p = nearestPrice(slW, reds.length ? reds : prices); if (p) out.sl = p.v; }

    // Fallbacks using the order of the coloured prices
    const vals = [...new Set(coloured.map((p) => p.v))].sort((a, b) => a - b);
    if (out.entry == null && vals.length === 3) out.entry = vals[1];
    if ((out.tp == null || out.sl == null) && out.entry != null) {
      const above = vals.filter((v) => v > out.entry), below = vals.filter((v) => v < out.entry);
      const hi = above.length ? above[above.length - 1] : null, lo = below.length ? below[0] : null;
      if (out.direction === 'sell') { if (out.tp == null) out.tp = lo; if (out.sl == null) out.sl = hi; }
      else { if (out.tp == null) out.tp = hi; if (out.sl == null) out.sl = lo; }
    }
    // Work out direction from the levels if the word was missed
    if (!out.direction && out.tp != null && out.entry != null) out.direction = out.tp > out.entry ? 'buy' : 'sell';

    delete out._dirWord;
    return out;
  }

  const DIR_LOTS = /\b(BUY|SELL)\s*([0-9]+(?:[.,][0-9]+)?)/i;

  async function read(dataUrl, onProgress) {
    await loadLib();
    const img = await loadImage(dataUrl);
    const { octx, processed } = prepare(img);
    const worker = await window.Tesseract.createWorker('eng', 1, {
      logger: (m) => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress * 0.85); },
    });
    try {
      const res = await worker.recognize(processed);
      const out = parse(res.data.words || [], octx);

      // The small "BUY 0.7" label often hides under the dashed line.
      // Second look: read just the strip of chart around the entry price.
      if (out.lots == null || !out.direction) {
        const m1 = DIR_LOTS.exec(res.data.text || '');
        if (m1) { out.direction = out.direction || m1[1].toLowerCase(); if (out.lots == null) out.lots = num(m1[2]); }
      }
      const entryWord = (res.data.words || []).find((w) => out.entry != null && w.text.replace(/[^\d.,]/g, '').replace(',', '.').includes(String(out.entry).padEnd(7, '0')));
      if ((out.lots == null || !out.direction) && entryWord) {
        const h = entryWord.bbox.y1 - entryWord.bbox.y0, cy = (entryWord.bbox.y0 + entryWord.bbox.y1) / 2;
        const y0 = Math.max(0, Math.round(cy - h * 2.2)), y1 = Math.min(processed.height, Math.round(cy + h * 0.6));
        const w = Math.round(processed.width * 0.75);
        const strip = document.createElement('canvas');
        strip.width = w * 2; strip.height = (y1 - y0) * 2;
        strip.getContext('2d').drawImage(processed, 0, y0, w, y1 - y0, 0, 0, strip.width, strip.height);
        const r2 = await worker.recognize(strip);
        const m2 = DIR_LOTS.exec(r2.data.text || '');
        if (m2) { out.direction = m2[1].toLowerCase(); if (out.lots == null) out.lots = num(m2[2]); }
      }
      if (onProgress) onProgress(1);
      return out;
    } finally {
      worker.terminate();
    }
  }

  return { read };
})();
