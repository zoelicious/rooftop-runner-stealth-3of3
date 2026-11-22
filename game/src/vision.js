// vision.js — vision cones, line of sight, and how visible Mira is.
import { rectsBlockingSight, pointOnSkylight } from './level.js';

export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  // Slab test: does segment (x1,y1)-(x2,y2) cross rect r?
  const dx = x2 - x1, dy = y2 - y1;
  let tmin = 0, tmax = 1;
  const axes = [
    [dx, x1 - r.x], [-dx, r.x + r.w - x1],
    [dy, y1 - r.y], [-dy, r.y + r.h - y1],
  ];
  for (const [d, n] of axes) {
    if (Math.abs(d) < 1e-9) { if (n < 0) return false; }
    else {
      let t = n / d;
      if (d < 0) { if (t > tmax) return false; if (t > tmin) tmin = t; }
      else { if (t < tmin) return false; if (t < tmax) tmax = t; }
    }
  }
  return true;
}

export function lineOfSightClear(ax, ay, bx, by) {
  for (const r of rectsBlockingSight()) {
    if (segmentHitsRect(ax, ay, bx, by, r)) return false;
  }
  return true;
}

// Is the player inside this guard's cone and actually seen?
export function guardSeesPlayer(guard, player) {
  const dx = player.x - guard.x, dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > guard.range) return { seen: false, dist };
  const ang = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(ang, guard.dir)) > guard.halfAngle) return { seen: false, dist };
  if (!lineOfSightClear(guard.x, guard.y, player.x, player.y)) return { seen: false, dist };
  return { seen: true, dist };
}

// Visibility word for the HUD: skylight glow exposes Mira, crouch + cover hides her.
export function visibilityOf(player, anyGuardSees) {
  if (pointOnSkylight(player.x, player.y)) return 'EXPOSED — SKYLIGHT';
  if (anyGuardSees) return 'SEEN!';
  if (player.crouching) return 'HIDDEN — CROUCHED';
  return 'IN SHADOW';
}
