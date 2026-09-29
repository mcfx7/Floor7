// Floor 7 drawing canvas for notes.
// Apple Pencil draws; a finger scrolls the page (unless finger drawing is switched on).
// Mouse and trackpad draw on PC. Strokes are stored relative to the canvas width,
// so drawings scale neatly between iPhone, iPad and PC.
const Sketch = (() => {
  const COLOURS = { ink: null, yellow: '#FFD60A', green: '#30D158', red: '#FF453A', blue: '#0A84FF' };

  function inkColour() {
    return getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#000';
  }

  function mount(box, drawing, onChange) {
    // drawing = { h: heightAsFractionOfWidth, strokes: [] }
    if (!drawing.h) drawing.h = 1.1;
    if (!drawing.strokes) drawing.strokes = [];
    const canvas = document.createElement('canvas');
    box.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let W = 0, dpr = 1;
    let tool = 'pen', colour = 'ink', finger = false;
    let current = null;
    const undoStack = [];

    function size() {
      dpr = window.devicePixelRatio || 1;
      W = box.clientWidth;
      const H = Math.round(W * drawing.h);
      canvas.style.height = H + 'px';
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      redraw();
    }

    function strokeStyle(s) {
      const c = s.c === 'ink' ? inkColour() : (COLOURS[s.c] || s.c);
      ctx.strokeStyle = c;
      ctx.globalAlpha = s.t === 'hi' ? 0.35 : 1;
      ctx.lineCap = s.t === 'hi' ? 'butt' : 'round';
      ctx.lineJoin = 'round';
    }

    function seg(s, a, b) {
      const base = s.t === 'hi' ? 0.03 : 0.004; // relative to width
      const p = s.t === 'hi' ? 1 : (0.45 + (b[2] ?? 0.5));
      ctx.lineWidth = Math.max(1, base * W * p) * dpr;
      ctx.beginPath();
      ctx.moveTo(a[0] * W * dpr, a[1] * W * dpr);
      ctx.lineTo(b[0] * W * dpr, b[1] * W * dpr);
      ctx.stroke();
    }

    function drawStroke(s) {
      strokeStyle(s);
      const pts = s.p;
      if (pts.length === 1) { seg(s, pts[0], [pts[0][0] + 0.0001, pts[0][1], pts[0][2]]); return; }
      if (s.t === 'hi') {
        // one path so overlapping parts don't get darker
        ctx.lineWidth = 0.03 * W * dpr;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] * W * dpr, pts[0][1] * W * dpr);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * W * dpr, pts[i][1] * W * dpr);
        ctx.stroke();
      } else {
        for (let i = 1; i < pts.length; i++) seg(s, pts[i - 1], pts[i]);
      }
    }

    function redraw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of drawing.strokes) drawStroke(s);
      if (current && current.t !== 'er') drawStroke(current);
      ctx.globalAlpha = 1;
    }

    function point(e) {
      const r = canvas.getBoundingClientRect();
      const pressure = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
      return [(e.clientX - r.left) / W, (e.clientY - r.top) / W, pressure];
    }

    function eraseAt(pt) {
      const radius = 0.02;
      const removed = [];
      drawing.strokes = drawing.strokes.filter((s, i) => {
        const hit = s.p.some((q) => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < radius);
        if (hit) removed.push({ s, i });
        return !hit;
      });
      if (removed.length) { current.removed.push(...removed); redraw(); }
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !finger) return; // finger scrolls
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const pt = point(e);
      if (tool === 'eraser') { current = { t: 'er', removed: [] }; eraseAt(pt); return; }
      current = { t: tool === 'hi' ? 'hi' : 'pen', c: colour, p: [pt] };
      redraw();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!current) return;
      e.preventDefault();
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (events.length ? events : [e])) {
        const pt = point(ev);
        if (current.t === 'er') { eraseAt(pt); continue; }
        const last = current.p[current.p.length - 1];
        current.p.push(pt);
        if (current.t === 'pen') { strokeStyle(current); seg(current, last, pt); ctx.globalAlpha = 1; }
      }
      if (current.t === 'hi') redraw();
      // Grow the page when drawing near the bottom
      const lastY = current.p ? current.p[current.p.length - 1][1] : 0;
      if (lastY > drawing.h - 0.15) { drawing.h += 0.5; size(); }
    });

    function end() {
      if (!current) return;
      if (current.t === 'er') {
        if (current.removed.length) { undoStack.push({ type: 'erase', removed: current.removed }); onChange(); }
      } else {
        current.p = current.p.map((q) => [+q[0].toFixed(4), +q[1].toFixed(4), +q[2].toFixed(2)]);
        drawing.strokes.push(current);
        undoStack.push({ type: 'add' });
        onChange();
      }
      current = null;
      redraw();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    const ro = new ResizeObserver(() => { if (box.clientWidth !== W) size(); });
    ro.observe(box);
    size();

    return {
      setTool(t) { tool = t; },
      setColour(c) { colour = c; },
      setFinger(on) { finger = on; box.classList.toggle('finger', on); },
      undo() {
        const u = undoStack.pop();
        if (!u) return false;
        if (u.type === 'add') drawing.strokes.pop();
        else u.removed.sort((a, b) => a.i - b.i).forEach(({ s, i }) => drawing.strokes.splice(i, 0, s));
        redraw(); onChange();
        return true;
      },
      redraw,
      destroy() { ro.disconnect(); canvas.remove(); },
    };
  }

  return { mount, COLOURS };
})();
