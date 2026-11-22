// level.js — the night rooftops: roofs, gaps, cover, lines, letters, exit.
export const WORLD = { width: 960, height: 720 };

// Three slate roofs in a row, split by two dark alleys. The street runs along the bottom.
export const ROOFS = [
  { id: 'A', x: 24,  y: 120, w: 264, h: 460 },
  { id: 'B', x: 328, y: 120, w: 264, h: 460 },
  { id: 'C', x: 632, y: 120, w: 304, h: 460 },
];
export const STREET = { x: 0, y: 600, w: 960, h: 120 };
export const ALLEYS = [
  { x: 288, y: 120, w: 40, h: 460 },
  { x: 592, y: 120, w: 40, h: 460 },
];

// Cover that blocks a guard's line of sight. Marked chimneys take the letters.
export const CHIMNEYS = [
  { x: 90,  y: 170, w: 34, h: 34, marked: 1, delivered: false },
  { x: 200, y: 470, w: 34, h: 34, marked: 0, delivered: false },
  { x: 380, y: 180, w: 34, h: 34, marked: 2, delivered: false },
  { x: 500, y: 430, w: 34, h: 34, marked: 0, delivered: false },
  { x: 700, y: 170, w: 34, h: 34, marked: 3, delivered: false },
  { x: 850, y: 460, w: 34, h: 34, marked: 0, delivered: false },
];
export const TANKS = [
  { x: 120, y: 330, r: 26 },
  { x: 430, y: 300, r: 26 },
  { x: 760, y: 320, r: 26 },
];
// Skylights glow from below: standing on one makes Mira plainly visible.
export const SKYLIGHTS = [
  { x: 150, y: 250, w: 56, h: 40 },
  { x: 460, y: 180, w: 56, h: 40 },
  { x: 700, y: 400, w: 56, h: 40 },
  { x: 830, y: 200, w: 56, h: 40 },
];
// Laundry lines span the alleys. Click one to zip across the gap.
export const LINES = [
  { id: 0, ax: 288, ay: 250, bx: 328, by: 250 },
  { id: 1, ax: 288, ay: 460, bx: 328, by: 460 },
  { id: 2, ax: 592, ay: 250, bx: 632, by: 250 },
  { id: 3, ax: 592, ay: 460, bx: 632, by: 460 },
];
export const EXIT = { x: 872, y: 260, w: 52, h: 84 };
export const PLAYER_START = { x: 70, y: 520 };

// Warm windows dotted over the roof faces (pure decoration, seeded).
export function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const WINDOWS = (() => {
  const rnd = seededRandom(20261121);
  const list = [];
  for (const roof of ROOFS) {
    for (let i = 0; i < 14; i++) {
      list.push({
        x: roof.x + 14 + rnd() * (roof.w - 40),
        y: roof.y + 14 + rnd() * (roof.h - 40),
        w: 12 + rnd() * 8, h: 16 + rnd() * 6,
        lit: rnd() > 0.35,
      });
    }
  }
  return list;
})();

// Pigeon flocks roost on roofs B and C. Running close scares them off.
export function makePigeons() {
  const rnd = seededRandom(77);
  const flocks = [];
  const spots = [
    { x: 360, y: 330 }, { x: 520, y: 240 }, { x: 670, y: 300 },
    { x: 780, y: 480 }, { x: 420, y: 500 },
  ];
  for (const spot of spots) {
    const birds = [];
    for (let i = 0; i < 5; i++) {
      birds.push({
        x: spot.x + (rnd() - 0.5) * 70, y: spot.y + (rnd() - 0.5) * 46,
        vx: 0, vy: 0, flying: false, gone: false, flap: rnd() * 6,
      });
    }
    flocks.push({ x: spot.x, y: spot.y, birds, scattered: false });
  }
  return flocks;
}

export function pointOnRoof(x, y) {
  return ROOFS.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}
export function pointOnSkylight(x, y) {
  return SKYLIGHTS.some((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}
export function rectsBlockingSight() {
  const rects = [];
  for (const c of CHIMNEYS) rects.push({ x: c.x, y: c.y, w: c.w, h: c.h });
  for (const t of TANKS) rects.push({ x: t.x - t.r, y: t.y - t.r, w: t.r * 2, h: t.r * 2 });
  return rects;
}
