// main.js — Rooftop Runner: bootstrap, game loop, rendering, input, shot presets.
import {
  WORLD, ROOFS, STREET, ALLEYS, CHIMNEYS, TANKS, SKYLIGHTS, LINES, EXIT,
  WINDOWS, makePigeons, pointOnSkylight, PLAYER_START,
} from './level.js';
import { makePlayer, updatePlayer, handleClick, updatePebbles, checkObjectives } from './player.js';
import { makeGuards, updateGuard } from './guard.js';
import { makeAudio } from './audio.js';
import { updateHud, showToast } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shot = params.get('shot') || '';

const world = {
  time: 0, noise: 0, pebbles: [],
  guards: makeGuards(), player: makePlayer(),
  pigeons: makePigeons(), audio: makeAudio(),
  won: false, lost: false, alarmSounded: false, holdZip: false,
  playerOnSkylight: false, nearMissUntil: -1, nearMissPct: 0,
  prevMaxSuspicion: 0,
  toast(text) { showToast(text, world); },
};

const input = { up: false, down: false, left: false, right: false, run: false, crouch: false };

function resetWorld() {
  world.time = 0; world.noise = 0; world.pebbles = [];
  world.guards = makeGuards(); world.player = makePlayer();
  world.pigeons = makePigeons();
  world.won = false; world.lost = false; world.alarmSounded = false;
  world.holdZip = false;
  world.nearMissUntil = -1; world.prevMaxSuspicion = 0;
  for (const c of CHIMNEYS) c.delivered = false;
  applyShotPreset();
}

function update(dt) {
  world.time += dt;
  world.noise = Math.max(0, world.noise - dt * 7);
  world.playerOnSkylight = pointOnSkylight(world.player.x, world.player.y);
  if (!world.won && !world.lost) {
    updatePlayer(world.player, input, dt, world);
    for (const g of world.guards) updateGuard(g, world.player, world, dt);
    updatePebbles(world, dt);
    updatePigeonFlocks(dt);
    checkObjectives(world.player, world);
    if (world.player.moving) world.audio.step(world.player.running, world.player.crouching, world.time);
    trackNearMiss();
  }
  updateHud(world);
}

function trackNearMiss() {
  const level = Math.max(world.guards[0].suspicion, world.guards[1].suspicion);
  if (world.prevMaxSuspicion >= 40 && level < 28 && world.time > world.nearMissUntil) {
    world.nearMissPct = 55 + Math.floor(Math.random() * 40);
    world.nearMissUntil = world.time + 3;
    world.audio.clink();
  }
  world.prevMaxSuspicion = level;
}

function updatePigeonFlocks(dt) {
  const p = world.player;
  for (const flock of world.pigeons) {
    if (!flock.scattered) {
      const d = Math.hypot(p.x - flock.x, p.y - flock.y);
      if ((p.running && d < 95) || (!p.crouching && p.moving && d < 45)) {
        flock.scattered = true;
        world.noise = Math.min(100, world.noise + 26);
        world.toast('Pigeons scattered — noise up!');
        for (const b of flock.birds) {
          const a = Math.atan2(b.y - p.y, b.x - p.x) + (Math.random() - 0.5);
          b.vx = Math.cos(a) * 190; b.vy = Math.sin(a) * 190 - 60;
          b.flying = true;
        }
      }
    }
    for (const b of flock.birds) {
      if (!b.flying || b.gone) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vy += 60 * dt; b.flap += dt * 30;
      if (b.y < 40 || b.x < -20 || b.x > 980) b.gone = true;
    }
  }
}

// ---------- rendering ----------
function drawCone(g) {
  const a0 = g.dir - g.halfAngle, a1 = g.dir + g.halfAngle;
  const grad = ctx.createRadialGradient(g.x, g.y, 10, g.x, g.y, g.range);
  grad.addColorStop(0, 'rgba(255, 205, 90, 0.34)');
  grad.addColorStop(1, 'rgba(255, 205, 90, 0.05)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.arc(g.x, g.y, g.range, a0, a1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255, 215, 120, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + Math.cos(a0) * g.range, g.y + Math.sin(a0) * g.range);
  ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + Math.cos(a1) * g.range, g.y + Math.sin(a1) * g.range);
  ctx.stroke();
}

function drawRoofs() {
  for (const r of ROOFS) {
    ctx.fillStyle = '#1d2a3a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#31435c'; ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(49, 67, 92, 0.5)'; ctx.lineWidth = 1;
    for (let x = r.x + 44; x < r.x + r.w; x += 44) {
      ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
    }
    for (let y = r.y + 44; y < r.y + r.h; y += 44) {
      ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    }
  }
  for (const w of WINDOWS) {
    ctx.fillStyle = w.lit ? 'rgba(255, 190, 90, 0.85)' : 'rgba(60, 75, 95, 0.8)';
    ctx.fillRect(w.x, w.y, w.w, w.h);
  }
}

function drawSkylights() {
  for (const s of SKYLIGHTS) {
    const glow = ctx.createRadialGradient(
      s.x + s.w / 2, s.y + s.h / 2, 4, s.x + s.w / 2, s.y + s.h / 2, 60);
    glow.addColorStop(0, 'rgba(255, 233, 168, 0.5)');
    glow.addColorStop(1, 'rgba(255, 233, 168, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(s.x - 40, s.y - 40, s.w + 80, s.h + 80);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = '#8a6d2f'; ctx.lineWidth = 2;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.beginPath(); ctx.moveTo(s.x + s.w / 2, s.y); ctx.lineTo(s.x + s.w / 2, s.y + s.h); ctx.stroke();
  }
}

function drawLines() {
  for (const line of LINES) {
    ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(line.ax, line.ay); ctx.lineTo(line.bx, line.by); ctx.stroke();
    const midX = (line.ax + line.bx) / 2, midY = (line.ay + line.by) / 2;
    ctx.fillStyle = '#e8ecf2';
    ctx.fillRect(midX - 9, midY, 8, 12);
    ctx.fillStyle = '#ffd9d9';
    ctx.fillRect(midX + 2, midY, 8, 12);
  }
}

function drawCover() {
  for (const c of CHIMNEYS) {
    ctx.fillStyle = '#8a4b3a';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = '#6d382c';
    ctx.fillRect(c.x - 3, c.y - 4, c.w + 6, 8);
    ctx.fillStyle = 'rgba(200, 200, 200, 0.16)';
    ctx.beginPath(); ctx.arc(c.x + 17, c.y - 12, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(c.x + 22, c.y - 22, 5, 0, Math.PI * 2); ctx.fill();
    if (c.marked && !c.delivered) {
      const pulse = 0.6 + 0.4 * Math.sin(world.time * 4);
      ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(c.x - 6, c.y - 6, c.w + 12, c.h + 12);
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('\u2709', c.x + 17, c.y - 12);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText('LETTER ' + c.marked, c.x + 17, c.y + c.h + 16);
    } else if (c.marked) {
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7ee2a8';
      ctx.fillText('\u2713', c.x + 17, c.y - 10);
    }
  }
  for (const t of TANKS) {
    ctx.fillStyle = '#42586e';
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 8, t.r, t.r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b7a99';
    ctx.fillRect(t.x - t.r, t.y - t.r, t.r * 2, t.r + 8);
    ctx.fillStyle = '#7fa0bd';
    ctx.beginPath(); ctx.ellipse(t.x, t.y - t.r, t.r, t.r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#33465a';
    ctx.beginPath(); ctx.ellipse(t.x, t.y - t.r, t.r * 0.55, t.r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawExit() {
  ctx.fillStyle = '#1d7a44';
  ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
  ctx.strokeStyle = '#2fbf71'; ctx.lineWidth = 3;
  ctx.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const y = EXIT.y + (EXIT.h / 6) * i;
    ctx.beginPath(); ctx.moveTo(EXIT.x + 6, y); ctx.lineTo(EXIT.x + EXIT.w - 6, y); ctx.stroke();
  }
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#bff5d2';
  ctx.fillText('EXIT', EXIT.x + EXIT.w / 2, EXIT.y - 8);
  ctx.fillStyle = '#2fbf71';
  ctx.beginPath();
  ctx.moveTo(EXIT.x + EXIT.w / 2 - 14, EXIT.y + EXIT.h + 26);
  ctx.lineTo(EXIT.x + EXIT.w / 2 + 14, EXIT.y + EXIT.h + 26);
  ctx.lineTo(EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h + 10);
  ctx.closePath(); ctx.fill();
}

function drawPigeons() {
  for (const flock of world.pigeons) {
    for (const b of flock.birds) {
      if (b.gone) continue;
      const flap = b.flying ? Math.sin(b.flap) * 5 : 0;
      ctx.fillStyle = '#b9c4cf';
      ctx.beginPath(); ctx.ellipse(b.x, b.y, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b98a5';
      ctx.beginPath(); ctx.arc(b.x + 5, b.y - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      if (b.flying) {
        ctx.strokeStyle = '#dfe7ef'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x - 4, b.y); ctx.lineTo(b.x - 10, b.y - 6 - flap); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x - 4, b.y); ctx.lineTo(b.x - 10, b.y + 6 + flap); ctx.stroke();
      }
    }
  }
}

function drawGuards() {
  for (const g of world.guards) {
    drawCone(g);
    // Lantern glow pool.
    const glow = ctx.createRadialGradient(g.x, g.y, 4, g.x, g.y, 46);
    glow.addColorStop(0, 'rgba(255, 210, 110, 0.55)');
    glow.addColorStop(1, 'rgba(255, 210, 110, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(g.x, g.y, 46, 0, Math.PI * 2); ctx.fill();
    // Body: high-contrast amber coat against the dark roof.
    ctx.fillStyle = '#0d1520';
    ctx.beginPath(); ctx.arc(g.x, g.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb020';
    ctx.beginPath(); ctx.arc(g.x, g.y, 13, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(g.x + Math.cos(g.dir) * 16, g.y + Math.sin(g.dir) * 16, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(g.kind === 'odo' ? 'ODO' : 'FEN', g.x, g.y - 20);
    if (g.say) {
      ctx.font = 'bold 15px sans-serif';
      const w = ctx.measureText(g.say).width + 16;
      ctx.fillStyle = 'rgba(5, 8, 12, 0.92)';
      ctx.fillRect(g.x - w / 2, g.y - 52, w, 22);
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5;
      ctx.strokeRect(g.x - w / 2, g.y - 52, w, 22);
      ctx.fillStyle = g.say === '!' ? '#ff6b5e' : '#ffe9a8';
      ctx.fillText(g.say, g.x, g.y - 36);
    }
  }
}

function drawPlayer() {
  const p = world.player;
  const bob = p.moving ? Math.sin(p.stepPhase) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 10, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Mira: teal cloak, amber scarf — bright against the slate roof.
  ctx.fillStyle = '#2fa39a';
  ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, p.crouching ? 9 : 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#bff5e8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, p.crouching ? 9 : 11, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.arc(p.x, p.y - 4 + bob * 0.3, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(p.x + Math.cos(p.dir) * 13, p.y + Math.sin(p.dir) * 13, 3, 0, Math.PI * 2); ctx.fill();
  if (p.zipping) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x - 14, p.y - 14); ctx.lineTo(p.x + 14, p.y + 14); ctx.stroke();
  }
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8fff6';
  ctx.fillText('MIRA', p.x, p.y - 18);
  if (p.crouching) {
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#9fb0c3';
    ctx.fillText('crouched', p.x, p.y + 26);
  }
}

function drawLabels() {
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(223, 231, 239, 0.85)';
  ctx.fillText('CHIMNEY: cover', 84, 160);
  ctx.fillText('SKYLIGHT: danger', 150, 244);
  ctx.fillText('LAUNDRY LINE: click to zip', 296, 274);
  ctx.fillText('WATER TANK: cover', 116, 322);
  ctx.fillText('PIGEONS: noise!', 330, 410);
  ctx.fillStyle = 'rgba(255, 233, 168, 0.9)';
  ctx.fillText('Watchman Odo sweeps the street below', 24, 596);
}

function drawPebbles() {
  for (const peb of world.pebbles) {
    const y = peb.y - (peb.arc || 0);
    if (peb.hold) {
      // Held mid-flight for the shot: dashed throw arc + halo so it reads.
      ctx.strokeStyle = 'rgba(255, 233, 168, 0.7)';
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(peb.sx, peb.sy); ctx.quadraticCurveTo((peb.sx + peb.x) / 2, y - 24, peb.x, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(peb.x, y, 11, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(peb.x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cfd8e3';
    ctx.beginPath(); ctx.arc(peb.x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(207, 216, 227, 0.5)';
    ctx.beginPath(); ctx.moveTo(peb.x, peb.y); ctx.lineTo(peb.x, y); ctx.stroke();
  }
}

function render() {
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  // Street along the bottom, alleys between roofs.
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(STREET.x, STREET.y, STREET.w, STREET.h);
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
  ctx.setLineDash([14, 18]);
  ctx.beginPath(); ctx.moveTo(0, 660); ctx.lineTo(960, 660); ctx.stroke();
  ctx.setLineDash([]);
  for (const a of ALLEYS) {
    ctx.fillStyle = '#05070a';
    ctx.fillRect(a.x, a.y, a.w, a.h);
  }
  drawRoofs();
  drawSkylights();
  drawLines();
  drawCover();
  drawExit();
  drawPigeons();
  drawPebbles();
  drawGuards();
  drawPlayer();
  drawLabels();
}

// ---------- input ----------
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
  if (e.code === 'KeyC') input.crouch = !input.crouch;
  if (e.code === 'KeyR') resetWorld();
  if (e.code === 'KeyM') world.audio.toggleMute();
  world.audio.unlock();
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false;
});
canvas.addEventListener('mousedown', (e) => {
  world.audio.unlock();
  const rect = canvas.getBoundingClientRect();
  const wx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const wy = (e.clientY - rect.top) * (canvas.height / rect.height);
  handleClick(world.player, wx, wy, world);
});

// ---------- screenshot presets (?shot=1..4) ----------
function applyShotPreset() {
  const p = world.player, fen = world.guards[1], odo = world.guards[0];
  if (shot === '1') {
    // Cover: NEAR MISS mid-zip — Mira rides the laundry line between roofs
    // while Fen's cone sweeps just past her, "?" up, exit in frame.
    world.time = 47;
    CHIMNEYS[0].delivered = true; p.letters = 1; p.pebbles = 2;
    p.zipping = { line: LINES[2], t: 0.5, fromX: 592, fromY: 250, toX: 632, toY: 250 };
    p.x = 612; p.y = 250; p.crouching = false; p.dir = 0;
    world.holdZip = true;
    fen.x = 740; fen.y = 210; fen.dir = 2.29; fen.suspicion = 50;
    fen.patrol = [{ x: 740, y: 210 }]; fen.patrolIndex = 0; // hold position for the shot
    fen.state = 'SUSPICIOUS'; fen.say = '?'; fen.sayUntil = 99999;
    odo.x = 430; odo.y = 660; odo.suspicion = 12;
    world.noise = 8;
    world.nearMissPct = 87; world.nearMissUntil = 99999;
    world.prevMaxSuspicion = 50;
  } else if (shot === '2') {
    // Patrol + pigeons: Mira creeps past a scattered flock, cones sweeping.
    world.time = 62;
    CHIMNEYS[0].delivered = true; p.letters = 1;
    p.x = 420; p.y = 360; p.crouching = true; p.dir = 0;
    for (const flock of world.pigeons) {
      if (Math.hypot(flock.x - 420, flock.y - 360) < 120) {
        flock.scattered = true;
        for (const b of flock.birds) {
          const a = Math.atan2(b.y - 360, b.x - 420);
          b.vx = Math.cos(a) * 150; b.vy = Math.sin(a) * 150 - 80;
          b.flying = true;
        }
      }
    }
    fen.x = 700; fen.y = 200; fen.dir = 0; fen.suspicion = 18;
    odo.x = 300; odo.y = 660; odo.suspicion = 6;
    world.noise = 30;
  } else if (shot === '3') {
    // Pebble distraction: Mira crouched behind a chimney, Fen turns to the clink.
    world.time = 83;
    CHIMNEYS[0].delivered = true; CHIMNEYS[2].delivered = true; p.letters = 2;
    p.x = 352; p.y = 214; p.crouching = true; p.dir = 0.3;
    world.pebbles.push({ sx: p.x, sy: p.y, x: 470, y: 238, tx: 540, ty: 240, t: 0.55, done: false, arc: 22, hold: true });
    fen.x = 660; fen.y = 250; fen.dir = 0; fen.suspicion = 45;
    fen.state = 'SUSPICIOUS';
    fen.investigate = { x: 540, y: 240, until: 99999 };
    fen.say = 'WHAT WAS THAT?'; fen.sayUntil = 99999;
    odo.x = 560; odo.y = 660; odo.suspicion = 10;
    world.noise = 12;
  } else if (shot === '4') {
    // Victory at the green stairs, unseen.
    world.time = 128;
    for (const c of CHIMNEYS) if (c.marked) c.delivered = true;
    p.letters = 3;
    p.x = EXIT.x + EXIT.w / 2; p.y = EXIT.y + EXIT.h / 2; p.dir = -Math.PI / 2;
    fen.x = 700; fen.y = 480; fen.dir = Math.PI; fen.suspicion = 0;
    odo.x = 200; odo.y = 660; odo.suspicion = 0;
    world.noise = 0;
    world.won = true;
  }
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
applyShotPreset();
requestAnimationFrame(frame);
