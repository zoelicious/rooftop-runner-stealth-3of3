// hud.js — the right-hand info panel and the minimap.
import { ROOFS, EXIT, CHIMNEYS, ALLEYS } from './level.js';
import { guardStatusWord } from './guard.js';
import { visibilityOf } from './vision.js';

const $ = (id) => document.getElementById(id);
const clockEl = $('clock'), detectionEl = $('detectionWord'), alarmFillEl = $('alarmFill');
const alarmMarkEl = $('alarmMark'), visibilityEl = $('visibility'), noiseEl = $('noise');
const lettersEl = $('letters'), spottedEl = $('spotted'), strikesEl = $('strikes');
const pebblesEl = $('pebbles'), goalEl = $('goal');
const odoEl = $('odoStatus'), fenEl = $('fenStatus');
const bannerEl = $('banner'), toastEl = $('toast');
const mini = $('minimap').getContext('2d');

export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function alarmWord(level) {
  if (level >= 85) return 'ALARM';
  if (level >= 55) return 'HUNTED';
  if (level >= 28) return 'SUSPICIOUS';
  if (level >= 8) return 'UNEASY';
  return 'CALM';
}

export function updateHud(world) {
  const p = world.player;
  const level = Math.max(world.guards[0].suspicion, world.guards[1].suspicion);
  const word = alarmWord(level);
  clockEl.textContent = fmtTime(world.time);
  detectionEl.textContent = word === 'CALM' ? 'CALM' : word;
  detectionEl.className = 'value ' + (level >= 55 ? 'hot' : level >= 28 ? 'warn' : 'ok');
  alarmFillEl.style.right = (100 - level) + '%';
  alarmMarkEl.style.left = level + '%';
  const anySeen = world.guards.some((g) => g.state === 'HUNTED' || g.state === 'ALARM');
  const vis = visibilityOf(p, anySeen);
  visibilityEl.textContent = vis;
  visibilityEl.className = 'value ' + (vis.startsWith('SEEN') || vis.startsWith('EXPOSED') ? 'hot' : vis.startsWith('HIDDEN') ? 'ok' : '');
  noiseEl.textContent = world.noise < 12 ? 'SILENT' : world.noise < 45 ? 'LOW' : world.noise < 75 ? 'LOUD' : 'VERY LOUD';
  noiseEl.className = 'value ' + (world.noise < 12 ? 'ok' : world.noise < 45 ? '' : 'hot');
  lettersEl.textContent = p.letters + ' / 3';
  spottedEl.textContent = String(p.spotted);
  strikesEl.textContent = '\u25CF'.repeat(Math.max(0, p.strikes)) + '\u25CB'.repeat(Math.max(0, 3 - p.strikes));
  pebblesEl.textContent = '\u25CF'.repeat(p.pebbles) + '\u25CB'.repeat(3 - p.pebbles);
  goalEl.textContent = p.letters < 3
    ? 'Deliver 3 letters to the marked chimneys (' + p.letters + '/3), then reach the green stairs unseen.'
    : 'All letters delivered — reach the green stairs!';
  odoEl.textContent = guardStatusWord(world.guards[0]) + ' \u00B7 ' + Math.round(world.guards[0].seenDist / 24) + 'm';
  fenEl.textContent = guardStatusWord(world.guards[1]) + ' \u00B7 ' + Math.round(world.guards[1].seenDist / 24) + 'm';

  if (world.won) {
    bannerEl.innerHTML = '<div class="big">NIGHT COMPLETE</div><div class="small">3 letters delivered — ghost bonus ' +
      (p.spotted === 0 ? '+500 UNSEEN' : 'lost') + ' &middot; time ' + fmtTime(world.time) + '</div>';
    bannerEl.classList.remove('hidden');
  } else if (world.lost) {
    bannerEl.innerHTML = '<div class="big">CAUGHT</div><div class="small">Three strikes — the night is over. Press R to try again.</div>';
    bannerEl.classList.remove('hidden');
  } else if (world.nearMissUntil > world.time) {
    bannerEl.innerHTML = '<div class="near">NEAR MISS &middot; ' + world.nearMissPct + '%</div>';
    bannerEl.classList.remove('hidden');
  } else {
    bannerEl.classList.add('hidden');
  }
  drawMinimap(world);
}

let toastTimer = 0;
export function showToast(text, world) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
}

export function drawMinimap(world) {
  const sx = 280 / 960, sy = 110 / 720;
  mini.fillStyle = '#0a0e14';
  mini.fillRect(0, 0, 280, 110);
  for (const r of ROOFS) {
    mini.fillStyle = '#24344a';
    mini.fillRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy);
  }
  for (const a of ALLEYS) {
    mini.fillStyle = '#05070a';
    mini.fillRect(a.x * sx, a.y * sy, a.w * sx, a.h * sy);
  }
  mini.fillStyle = '#2fbf71';
  mini.fillRect(EXIT.x * sx, EXIT.y * sy, EXIT.w * sx, EXIT.h * sy);
  for (const c of CHIMNEYS) {
    if (!c.marked) continue;
    mini.fillStyle = c.delivered ? '#7ee2a8' : '#ffd166';
    mini.fillRect(c.x * sx, c.y * sy, 10, 10);
  }
  for (const g of world.guards) {
    mini.fillStyle = g.state === 'ALARM' ? '#ff3b30' : '#ffb020';
    mini.beginPath(); mini.arc(g.x * sx, g.y * sy, 4, 0, Math.PI * 2); mini.fill();
  }
  const p = world.player;
  mini.fillStyle = '#fff';
  mini.beginPath(); mini.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2); mini.fill();
  mini.strokeStyle = '#fff'; mini.lineWidth = 1;
  mini.beginPath(); mini.arc(p.x * sx, p.y * sy, 6.5, 0, Math.PI * 2); mini.stroke();
}
