// The HUD: everything the player reads without leaving the world — money, health
// and the clock over the street name; the wanted stars; a minimap with the law,
// the job and the next fixer on it; the mission objective with its distance and
// clock; the bust meter; dialogs and toasts. Drawn in screen space, after the world.
import { FONT, PALETTE, VIEW, WANTED } from './config.js';
import { districtAt } from './city.js';
import { nextGiver } from './missions.js';
import { distance } from './random.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23f' : 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke();
}

/** The clock as the bay tells it: 24h, two digits each. */
export function clockText(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawMinimap(ctx, state, x, y, w, h) {
  const city = state.city;
  const s = Math.min(w / city.width, h / city.height);
  const ox = x + (w - city.width * s) / 2;
  const oy = y + (h - city.height * s) / 2;
  const px = (wx) => ox + wx * s;
  const py = (wy) => oy + wy * s;
  ctx.save();
  panel(ctx, x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = '#3f7d4e';
  ctx.fillRect(ox, oy, city.width * s, city.height * s);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(ox, py(city.sandY), city.width * s, (city.waterY - city.sandY) * s);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(ox, py(city.waterY), city.width * s, (city.height - city.waterY) * s);
  ctx.strokeStyle = 'rgba(240,240,230,0.55)';
  ctx.lineWidth = 1.4;
  for (const rx of city.vRoads) { ctx.beginPath(); ctx.moveTo(px(rx), oy); ctx.lineTo(px(rx), py(city.roadsBottom)); ctx.stroke(); }
  for (const ry of city.hRoads) { ctx.beginPath(); ctx.moveTo(ox, py(ry)); ctx.lineTo(px(city.roadsRight), py(ry)); ctx.stroke(); }
  // The law, flashing as it does.
  const flash = Math.floor(state.time * 2.4) % 2 === 0;
  for (const car of state.cars) {
    if (car.driver !== 'police' && car.driver !== 'roadblock') continue;
    ctx.fillStyle = flash ? '#ff4757' : '#54a0ff';
    ctx.fillRect(px(car.x) - 2, py(car.y) - 2, 4, 4);
  }
  // The job, or the fixer who holds it.
  const target = state.mission ? state.mission.target : null;
  const giver = !state.mission ? nextGiver(state) : null;
  const blip = target || giver;
  if (blip) {
    ctx.fillStyle = PALETTE.mission;
    ctx.beginPath();
    ctx.arc(px(blip.x), py(blip.y), 4 + Math.sin(state.time * 5) * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.stroke();
  }
  // The player, a white wedge on the heading.
  const p = state.player;
  const cx = px(p.car ? p.car.x : p.x);
  const cy = py(p.car ? p.car.y : p.y);
  const ang = p.car ? p.car.angle : p.angle;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(ang) * 6, cy + Math.sin(ang) * 6);
  ctx.lineTo(cx + Math.cos(ang + 2.5) * 4.6, cy + Math.sin(ang + 2.5) * 4.6);
  ctx.lineTo(cx + Math.cos(ang - 2.5) * 4.6, cy + Math.sin(ang - 2.5) * 4.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObjective(ctx, state) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  let title = null;
  let label = null;
  let dist = null;
  let extra = '';
  if (state.mission) {
    title = state.mission.def.title;
    label = state.mission.target ? state.mission.target.label : state.mission.step.label;
    if (state.mission.target) dist = Math.round(distance(px, py, state.mission.target.x, state.mission.target.y) / 10);
    if (state.mission.timeLeft !== null) extra = ` — ${Math.max(0, Math.ceil(state.mission.timeLeft))}s`;
    if (state.mission.step.type === 'hold') extra = ` — ${Math.max(0, Math.ceil(state.mission.step.seconds - state.mission.holdT))}s`;
    if (state.mission.step.type === 'loseheat' && state.heat >= 0.4) extra = ' — heat too high';
  } else {
    const giver = nextGiver(state);
    if (giver) {
      title = 'Next job';
      label = `See the fixer at ${giver.name}`;
      dist = Math.round(distance(px, py, giver.x, giver.y) / 10);
    } else {
      title = 'Palm Bay is yours';
      label = 'Every job is done. The bay keeps turning.';
    }
  }
  if (!title) return;
  panel(ctx, 16, VIEW.height - 86, 430, 70);
  ctx.fillStyle = PALETTE.mission;
  ctx.font = `700 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(title.toUpperCase(), 30, VIEW.height - 60);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `15px ${FONT}`;
  const line = dist !== null ? `${label} · ${dist}m${extra}` : `${label}${extra}`;
  ctx.fillText(line, 30, VIEW.height - 36);
}

function drawDialog(ctx, state) {
  const d = state.dialog;
  const w = 720;
  const x = (VIEW.width - w) / 2;
  const y = VIEW.height - 158;
  panel(ctx, x, y, w, 62);
  ctx.fillStyle = PALETTE.mission;
  ctx.font = `700 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(d.speaker.toUpperCase(), x + 20, y + 22);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `16px ${FONT}`;
  const line = d.lines[d.index];
  ctx.fillText(line.length > 92 ? `${line.slice(0, 92)}…` : line, x + 20, y + 46);
  ctx.fillStyle = 'rgba(245,242,232,0.65)';
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('E ▸', x + w - 16, y + 46);
  ctx.textAlign = 'left';
}

export function drawHUD(ctx, state) {
  const p = state.player;
  // Money, health, clock, street.
  panel(ctx, 16, 16, 252, 84);
  ctx.fillStyle = '#2ed573';
  ctx.font = `800 26px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.money}`, 30, 50);
  ctx.fillStyle = 'rgba(245,242,232,0.75)';
  ctx.font = `13px ${FONT}`;
  const where = p.car ? p.car.kind.toUpperCase() : districtAt(state.city, p.x, p.y);
  ctx.fillText(`${clockText(state.clockMinutes)} · ${where}`, 30, 72);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(30, 82, 150, 8);
  ctx.fillStyle = p.hp > 30 ? '#2ed573' : '#ff4757';
  ctx.fillRect(30, 82, 150 * Math.max(0, p.hp) / 100, 8);
  if (p.car) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(190, 82, 62, 8);
    ctx.fillStyle = '#54a0ff';
    ctx.fillRect(190, 82, 62 * Math.max(0, p.car.hp) / p.car.maxHp, 8);
  }
  // Wanted stars, top centre.
  for (let i = 0; i < WANTED.max; i += 1) {
    star(ctx, VIEW.width / 2 - 64 + i * 32, 34, 13, i < state.stars);
  }
  if (state.stars > 0 && state.seenTimer > 2 && state.heat > 0.05) {
    ctx.fillStyle = 'rgba(245,242,232,0.8)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('cooling off…', VIEW.width / 2, 62);
    ctx.textAlign = 'left';
  }
  drawMinimap(ctx, state, VIEW.width - 216, 16, 196, 168);
  drawObjective(ctx, state);
  // Bust meter.
  if (state.bustMeter > 0.02) {
    const w = 300;
    const x = (VIEW.width - w) / 2;
    panel(ctx, x - 10, 76, w + 20, 34);
    ctx.fillStyle = '#ff4757';
    ctx.font = `800 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', VIEW.width / 2, 91);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x, 98, w, 6);
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(x, 98, w * state.bustMeter, 6);
    ctx.textAlign = 'left';
  }
  // Context prompt ("E — take the sedan").
  if (state.prompt && !state.dialog) {
    ctx.font = `700 16px ${FONT}`;
    const w = ctx.measureText(state.prompt).width + 36;
    const x = (VIEW.width - w) / 2;
    panel(ctx, x, VIEW.height - 190, w, 36);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(state.prompt, VIEW.width / 2, VIEW.height - 166);
    ctx.textAlign = 'left';
  }
  // Driving speed, bottom right.
  if (p.car) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 24px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.36)} km/h`, VIEW.width - 24, VIEW.height - 28);
    ctx.textAlign = 'left';
  }
  if (state.dialog) drawDialog(ctx, state);
  // Toast.
  if (state.toast && state.time < state.toast.until) {
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.mission;
    ctx.font = `900 40px ${FONT}`;
    ctx.fillText(state.toast.text, VIEW.width / 2, 150);
    if (state.toast.sub) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `17px ${FONT}`;
      ctx.fillText(state.toast.sub, VIEW.width / 2, 178);
    }
    ctx.textAlign = 'left';
  }
}
