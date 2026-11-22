// guard.js — Watchman Odo (street lantern) and Watchman Fen (roof patrol).
import { angleTo, angleDiff, guardSeesPlayer } from './vision.js';
import { pointOnRoof } from './level.js';

export function makeGuards() {
  return [
    {
      name: 'Watchman Odo', kind: 'odo',
      x: 430, y: 660, dir: -Math.PI / 2, // lantern sweeps up from the street
      range: 210, halfAngle: 0.42, baseRange: 210, baseHalf: 0.42,
      speed: 42, patrol: [{ x: 120, y: 660 }, { x: 840, y: 660 }],
      patrolIndex: 1, suspicion: 0, state: 'PATROL', seenDist: 240,
      say: '', sayUntil: 0, investigate: null, sweepPhase: 0,
      caughtCooldown: 0,
    },
    {
      name: 'Watchman Fen', kind: 'fen',
      x: 700, y: 200, dir: Math.PI,
      range: 190, halfAngle: 0.46, baseRange: 190, baseHalf: 0.46,
      speed: 55, patrol: [{ x: 660, y: 200 }, { x: 900, y: 200 }, { x: 900, y: 520 }, { x: 660, y: 520 }],
      patrolIndex: 1, suspicion: 0, state: 'PATROL', seenDist: 240,
      say: '', sayUntil: 0, investigate: null, sweepPhase: 1.3,
      caughtCooldown: 0,
    },
  ];
}

function moveToward(g, tx, ty, speed, dt) {
  const d = Math.hypot(tx - g.x, ty - g.y);
  if (d < 2) return true;
  const step = Math.min(d, speed * dt);
  g.x += ((tx - g.x) / d) * step;
  g.y += ((ty - g.y) / d) * step;
  g.dir = turnToward(g.dir, Math.atan2(ty - g.y, tx - g.x), dt * 5);
  return d - step < 2;
}

function turnToward(from, to, maxStep) {
  const d = angleDiff(to, from);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

export function updateGuard(g, player, world, dt) {
  const seen = guardSeesPlayer(g, player);
  const onSkylight = world.playerOnSkylight;
  const exposed = seen.seen && (onSkylight || !player.crouching || seen.dist < 70);

  // Detection rises while seen, falls while hidden. Skylight light doubles the rise.
  if (exposed) g.suspicion = Math.min(100, g.suspicion + dt * (onSkylight ? 90 : 55));
  else g.suspicion = Math.max(0, g.suspicion - dt * (g.state === 'ALARM' ? 6 : 16));

  if (g.suspicion >= 85) g.state = 'ALARM';
  else if (g.suspicion >= 55) g.state = 'HUNTED';
  else if (g.suspicion >= 28) g.state = 'SUSPICIOUS';
  else g.state = g.investigate ? 'CURIOUS' : 'PATROL';

  if (g.state === 'SUSPICIOUS' && !g.say) { g.say = '?'; g.sayUntil = world.time + 1.6; }
  if (g.state === 'HUNTED' && !g.say) { g.say = '!'; g.sayUntil = world.time + 1.6; }
  if (world.time > g.sayUntil) g.say = '';

  // Alarm: cone widens briefly, guard closes in on Mira.
  g.range = g.state === 'ALARM' ? g.baseRange + 45 : g.baseRange;
  g.halfAngle = g.state === 'ALARM' ? g.baseHalf + 0.16 : g.baseHalf;
  if (g.state === 'ALARM' && g.suspicion < 85) g.suspicion = 85;

  if (g.state === 'ALARM' || g.state === 'HUNTED') {
    moveToward(g, player.x, player.y, g.speed * 1.7, dt);
    if (g.state === 'ALARM' && !world.alarmSounded) {
      world.alarmSounded = true;
      world.audio.alarm();
      world.toast('ALARM! Break line of sight and hide!');
    }
  } else if (g.investigate && world.time < g.investigate.until) {
    if (moveToward(g, g.investigate.x, g.investigate.y, g.speed * 1.25, dt)) {
      // Arrived: look around, then give up.
      g.dir += dt * 1.4;
      if (world.time > g.investigate.until - 0.4) g.investigate = null;
    }
  } else {
    g.investigate = null;
    const target = g.patrol[g.patrolIndex];
    if (moveToward(g, target.x, target.y, g.speed, dt)) {
      g.patrolIndex = (g.patrolIndex + 1) % g.patrol.length;
    }
    // Odo's lantern sweeps the roof edge as he walks the street.
    if (g.kind === 'odo') {
      g.sweepPhase += dt;
      g.dir = -Math.PI / 2 + Math.sin(g.sweepPhase * 0.9) * 0.55;
    }
  }

  if (g.state !== 'ALARM') world.alarmSounded = false;

  // Caught: guard touches Mira.
  if (g.caughtCooldown <= 0 && Math.hypot(g.x - player.x, g.y - player.y) < 26) {
    g.caughtCooldown = 2;
    player.strikes -= 1;
    player.spotted += 1;
    world.audio.caught();
    if (player.strikes <= 0) {
      world.lost = true;
    } else {
      world.toast(`Spotted by ${g.name}! ${player.strikes} strike${player.strikes === 1 ? '' : 's'} left — back to the start roof.`);
      player.x = 70; player.y = 520; player.zipping = null;
      for (const gg of world.guards) { gg.suspicion = 20; gg.investigate = null; }
    }
  }
  g.caughtCooldown = Math.max(0, g.caughtCooldown - dt);
  g.seenDist = seen.dist;
}

export function guardStatusWord(g) {
  if (g.state === 'ALARM') return 'ALARM';
  if (g.state === 'HUNTED') return 'HUNTING';
  if (g.state === 'SUSPICIOUS') return 'SUSPICIOUS';
  if (g.state === 'CURIOUS') return 'CHECKING NOISE';
  return 'PATROL';
}
export { angleTo };
