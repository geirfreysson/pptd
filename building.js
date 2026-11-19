// The animation on the empty stage while the agent is running and no deck is open
// (body.agent-busy without .has-deck). A block-letter PPTD is assembled by one effect,
// held with a shimmer, dissolved, and assembled again by the next effect.
(() => {
  const FONT = {
    P: ['█████ ', '██  ██', '██  ██', '█████ ', '██    ', '██    ', '██    '],
    T: ['██████', '  ██  ', '  ██  ', '  ██  ', '  ██  ', '  ██  ', '  ██  '],
    D: ['█████ ', '██  ██', '██  ██', '██  ██', '██  ██', '██  ██', '█████ '],
  };
  const WORD = 'PPTD';
  const GAP = 2;
  const ROWS = 7;
  const GLYPHS = '01<>/\\|=+*#%&$?!{}[]~:;^';
  const STOPS = [[20, 161, 158], [61, 214, 208], [139, 233, 253], [195, 166, 255]];
  const BUILD = 4.2, HOLD = 2.2, EXIT = 1.1, CYCLE = BUILD + HOLD + EXIT;

  const canvas = document.getElementById('buildCanvas');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // Target cells of the word, in grid units.
  const cells = [];
  let col = 0;
  for (const ch of WORD) {
    FONT[ch].forEach((line, r) => [...line].forEach((c, k) => { if (c !== ' ') cells.push({ gx: col + k, gy: r }); }));
    col += FONT[ch][0].length + GAP;
  }
  const COLS = col - GAP;

  let W = 0, H = 0, cw = 0, chh = 0, ox = 0, oy = 0;
  let raf = 0, start = 0, cycle = -1, effect = null;

  const rnd = (i, salt) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
  const glyph = (i, t) => GLYPHS[Math.floor(rnd(i, Math.floor(t * 14)) * GLYPHS.length)];
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const easeOut = (x) => 1 - (1 - x) ** 3;
  const easeIn = (x) => x * x;

  function colour(fx, t, flash) {
    let p = (fx * 0.8 + t * 0.12) % 2; if (p > 1) p = 2 - p;
    const s = p * (STOPS.length - 1), i = Math.min(STOPS.length - 2, Math.floor(s)), f = s - i;
    const c = STOPS[i].map((v, k) => v + (STOPS[i + 1][k] - v) * f);
    return c.map((v) => Math.round(v + (255 - v) * flash));
  }

  function layout() {
    const r = canvas.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cw = Math.max(2, Math.min(22, (W * 0.72) / COLS, (H * 0.85) / (ROWS * 1.7)));
    chh = cw * 1.7;
    ox = (W - COLS * cw) / 2; oy = (H - ROWS * chh) / 2;
  }

  // Each effect: (cell index, cell, time since build start) → null (not shown) or
  // { x, y, g: glyph or null for the settled block, flash 0..1, a: alpha }.
  const EFFECTS = [
    function decrypt(i, c, t) {
      const s = 0.2 + rnd(i, 1) * (BUILD - 0.8);
      const x = ox + c.gx * cw, y = oy + c.gy * chh;
      if (t < s) return { x, y, g: glyph(i, t), flash: 0, a: 0.35 + 0.4 * rnd(i, 2) };
      return { x, y, g: null, flash: clamp(1 - (t - s) / 0.4), a: 1 };
    },
    function rain(i, c, t) {
      const s = rnd(i, 3) * (BUILD - 1.2), d = 0.9;
      const x = ox + c.gx * cw, ty = oy + c.gy * chh;
      if (t < s) return null;
      if (t < s + d) return { x, y: -chh + (ty + chh) * easeIn((t - s) / d), g: glyph(i, t), flash: 0.3, a: 0.9 };
      return { x, y: ty, g: null, flash: clamp(1 - (t - s - d) / 0.35), a: 1 };
    },
    function beams(i, c, t) {
      const ltr = c.gy % 2 === 0;
      const s = c.gy * 0.32 + (ltr ? c.gx : COLS - 1 - c.gx) * 0.045;
      const x = ox + c.gx * cw, y = oy + c.gy * chh;
      if (t < s - 0.25) return null;
      if (t < s) return { x, y, g: glyph(i, t), flash: 1, a: 1 - (s - t) / 0.25 };
      return { x, y, g: null, flash: clamp(1 - (t - s) / 0.6), a: 1 };
    },
    function converge(i, c, t) {
      const s = rnd(i, 4) * 1.2, d = 2.2;
      const fx = rnd(i, 5) * W, fy = rnd(i, 6) * H;
      const tx = ox + c.gx * cw, ty = oy + c.gy * chh;
      const p = clamp((t - s) / d);
      if (p < 1) { const e = easeOut(p); return { x: fx + (tx - fx) * e, y: fy + (ty - fy) * e, g: glyph(i, t), flash: 0, a: 0.25 + 0.65 * p }; }
      return { x: tx, y: ty, g: null, flash: clamp(1 - (t - s - d) / 0.4), a: 1 };
    },
    function ripple(i, c, t) {
      const dx = c.gx - COLS / 2, dy = (c.gy - ROWS / 2) * 1.7;
      const s = Math.hypot(dx, dy) / Math.hypot(COLS / 2, ROWS) * (BUILD - 1);
      const x = ox + c.gx * cw, y = oy + c.gy * chh;
      if (t < s - 0.4) return null;
      if (t < s) return { x, y, g: glyph(i, t), flash: 0.6, a: 1 - (s - t) / 0.4 };
      return { x, y, g: null, flash: clamp(1 - (t - s) / 0.5), a: 1 };
    },
  ];

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = `${Math.round(chh * 0.78)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const n = Math.floor(t / CYCLE);
    if (n !== cycle) {
      cycle = n;
      let next; do { next = EFFECTS[Math.floor(Math.random() * EFFECTS.length)]; } while (next === effect && EFFECTS.length > 1);
      effect = next;
    }
    const local = t - n * CYCLE;
    cells.forEach((c, i) => {
      let s = effect(i, c, Math.min(local, BUILD + HOLD));
      if (!s) return;
      if (local > BUILD + HOLD) { // dissolve: each cell flickers to a glyph, then goes
        const e = (local - BUILD - HOLD) / EXIT, at = rnd(i, 7) * 0.7;
        if (e > at + 0.3) return;
        if (e > at) s = { ...s, g: glyph(i, t), flash: 0, a: 1 - (e - at) / 0.3 };
      }
      const [r, g, b] = colour(c.gx / COLS, t, s.flash);
      ctx.globalAlpha = s.a;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      if (s.g) ctx.fillText(s.g, s.x + cw / 2, s.y + chh / 2);
      else ctx.fillRect(s.x + 0.5, s.y + 0.5, cw - 1, chh - 1);
    });
    ctx.globalAlpha = 1;
  }

  // 30 fps is plenty for a terminal-style effect, and a quarter of the work on a 120 Hz screen.
  let lastDraw = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - lastDraw < 1000 / 30 - 2) return;
    lastDraw = now;
    draw((now - start) / 1000);
  }

  function update() {
    const on = document.body.classList.contains('agent-busy') && !document.body.classList.contains('has-deck');
    if (on && !raf && !start) {
      layout(); cycle = -1; effect = null;
      if (reduce.matches) { draw(BUILD + 0.01); start = -1; return; } // the still logo
      start = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!on && (raf || start)) {
      cancelAnimationFrame(raf); raf = 0; start = 0;
    }
  }

  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new ResizeObserver(() => { if (raf || start) { layout(); if (!raf) draw(BUILD + 0.01); } }).observe(canvas);
  update();
})();
