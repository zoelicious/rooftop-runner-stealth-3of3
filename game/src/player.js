// player.js — Mira the rooftop runner: walk, run, crouch, zip, throw pebbles.
import { pointOnRoof, LINES, CHIMNEYS, EXIT } from './level.js';

export function makePlayer() {
  return {
    x: 70, y: 520, r: 11, dir: 0,
    speed: 0, running: false, crouching: false,
    moving: false, stepPhase: 0,
    zipping: null, // {line, t, fromX, fromY, toX, toY}
    pebbles: 3, letters: 0, spotted: 0, strikes: 3,
    onSkylight: false,
  };
}

const WALK = 115, RUN = 205, CROUCH = 55;

export function updatePlayer(p, input, dt, world) {
  if (world.won || world.lost) return;
  // Zip along a laundry line: fast, noisy, locked to the line.
  // A held zip (screenshot preset) stays mid-line for the shot.
  if (p.zipping) {
    const z = p.zipping;
    if (!world.holdZip) z.t += dt / 0.45;
    const t = Math.min(1, z.t);
    p.x = z.fromX + (z.toX - z.fromX) * t;
    p.y = z.fromY + (z.toY - z.fromY) * t;
    p.dir = Math.atan2(z.toY - z.fromY, z.toX - z.fromX);
    p.moving = true;
    if (t >= 1) {
      p.zipping = null;
      world.noise = Math.min(100, world.noise + 18);
      world.toast('Zipped across — that was loud!');
    }
    return;
  }
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (!p.moving) { p.speed = 0; return; }
  mx /= len; my /= len;
  p.crouching = !!input.crouch;
  p.running = !!input.run && !p.crouching;
  const speed = p.crouching ? CROUCH : p.running ? RUN : WALK;
  p.speed = speed;
  p.dir = Math.atan2(my, mx);
  const nx = p.x + mx * speed * dt;
  const ny = p.y + my * speed * dt;
  // Roofs only: alleys and the street block on foot (zip to cross).
  if (pointOnRoof(nx, p.y)) p.x = nx;
  if (pointOnRoof(p.x, ny)) p.y = ny;
  p.stepPhase += dt * (p.running ? 11 : p.crouching ? 4 : 7);
  if (p.running) world.noise = Math.min(100, world.noise + dt * 14);
}

// Click a laundry line near Mira to zip; click open ground to throw a pebble.
export function handleClick(p, wx, wy, world) {
  if (world.won || world.lost) return;
  for (const line of LINES) {
    const d = distToSegment(wx, wy, line.ax, line.ay, line.bx, line.by);
    const nearEnd = Math.min(
      Math.hypot(p.x - line.ax, p.y - line.ay),
      Math.hypot(p.x - line.bx, p.y - line.by),
    );
    if (d < 14 && nearEnd < 90) {
      const fromLeft = Math.hypot(p.x - line.ax, p.y - line.ay) < Math.hypot(p.x - line.bx, p.y - line.by);
      p.zipping = {
        line, t: 0,
        fromX: fromLeft ? line.ax : line.bx, fromY: fromLeft ? line.ay : line.by,
        toX: fromLeft ? line.bx : line.ax, toY: fromLeft ? line.by : line.ay,
      };
      world.audio.zip();
      return;
    }
  }
  if (p.pebbles > 0) {
    p.pebbles -= 1;
    world.pebbles.push({ sx: p.x, sy: p.y, x: p.x, y: p.y, tx: wx, ty: wy, t: 0, done: false, arc: 0 });
    world.audio.pebble();
  } else {
    world.toast('No pebbles left!');
  }
}

export function updatePebbles(world, dt) {
  for (const peb of world.pebbles) {
    if (peb.done || peb.hold) continue; // a held pebble hangs mid-air for the shot
    peb.t += dt / 0.5;
    const t = Math.min(1, peb.t);
    peb.x = peb.sx + (peb.tx - peb.sx) * t;
    peb.y = peb.sy + (peb.ty - peb.sy) * t;
    peb.arc = Math.sin(t * Math.PI) * 26;
    if (peb.t >= 1) {
      peb.done = true;
      peb.landedAt = world.time;
      peb.arc = 0;
      world.audio.clink();
      for (const g of world.guards) {
        const d = Math.hypot(g.x - peb.x, g.y - peb.y);
        if (d < 260) {
          g.investigate = { x: peb.x, y: peb.y, until: world.time + 4 };
          g.suspicion = Math.max(g.suspicion, 45);
          g.say = 'WHAT WAS THAT?';
          g.sayUntil = world.time + 2.2;
        }
      }
    }
  }
  world.pebbles = world.pebbles.filter((peb) => !peb.done || world.time - (peb.landedAt ?? world.time) < 0.6);
}

// Deliver a letter by reaching a marked chimney; reach the stairs with 3/3 to win.
export function checkObjectives(p, world) {
  for (const c of CHIMNEYS) {
    if (c.marked && !c.delivered) {
      const d = Math.hypot(p.x - (c.x + 17), p.y - (c.y + 17));
      if (d < 34) {
        c.delivered = true;
        p.letters += 1;
        world.audio.chime();
        world.toast(`Letter ${p.letters} of 3 delivered!`);
        if (p.letters === 3) world.toast('All letters delivered — reach the green stairs!');
      }
    }
  }
  if (p.letters >= 3) {
    const cx = EXIT.x + EXIT.w / 2, cy = EXIT.y + EXIT.h / 2;
    if (Math.hypot(p.x - cx, p.y - cy) < 42) {
      world.won = true;
      world.audio.win();
    }
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
