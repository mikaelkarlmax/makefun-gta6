// Drawing only: the world and the screens in, pixels out. Palm Bay is painted
// top-down with a lean — buildings extrude toward the north by their height, so
// Downtown towers over the Marina — under a sky that follows the clock: clear
// noon, orange dusk, lamp-lit night. The HUD is hud.js; this file paints the
// streets, the actors, the light, and the title / pause / busted / wasted /
// complete screens over them.
import { CITY, FONT, PALETTE, VIEW } from './config.js';
import { drawHUD } from './hud.js';
import { SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_TITLE, SCREEN_WASTED } from './world.js';
import { clamp, lerp } from './random.js';

/** Sky tint for a clock time: [alpha, colour] blended over the world. */
function skyTint(minutes) {
  const h = minutes / 60;
  const stops = [
    [0, 0.42, '#0a1030'], [5, 0.42, '#0a1030'], [6.5, 0.16, '#ff9a3c'],
    [8, 0, '#000000'], [17, 0, '#000000'], [18.6, 0.2, '#ff8a3c'],
    [20, 0.4, '#0a1030'], [24, 0.42, '#0a1030'],
  ];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [h0, a0, c0] = stops[i];
    const [h1, a1] = stops[i + 1];
    if (h >= h0 && h <= h1) {
      const t = (h - h0) / (h1 - h0 || 1);
      return { alpha: lerp(a0, a1, t), color: c0 };
    }
  }
  return { alpha: 0, color: '#000000' };
}

function isNight(minutes) {
  const h = minutes / 60;
  return h < 6 || h > 19;
}

function drawBuilding(ctx, b) {
  const lift = b.height * 0.36;
  // Shadow first, thrown south-east.
  ctx.fillStyle = 'rgba(20, 24, 20, 0.25)';
  ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
  // Walls: the extruded sides between the footprint and the lifted roof.
  ctx.fillStyle = b.wall;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h - lift);
  ctx.lineTo(b.x, b.y + b.h - lift);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath();
  ctx.moveTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h - lift);
  ctx.lineTo(b.x + b.w, b.y - lift);
  ctx.closePath();
  ctx.fill();
  // The roof itself.
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y - lift, b.w, b.h);
  ctx.strokeStyle = 'rgba(60, 50, 30, 0.35)';
  ctx.strokeRect(b.x + 0.5, b.y - lift + 0.5, b.w - 1, b.h - 1);
  // Roof furniture: a water tank or an AC block, a parapet line.
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  const fw = Math.min(26, b.w * 0.3);
  const fh = Math.min(20, b.h * 0.3);
  ctx.fillRect(b.x + b.w * 0.16, b.y - lift + b.h * 0.14, fw, fh);
  if (b.style === 'towers') {
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        ctx.fillRect(b.x + 8 + i * 24, b.y - lift + 8 + j * 24, 10, 6);
      }
    }
  }
  // The name, small along the roof, when the roof is big enough to carry it.
  if (b.w > 92 && b.h > 60) {
    ctx.fillStyle = 'rgba(40, 36, 28, 0.62)';
    ctx.font = `600 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y - lift + b.h / 2 + 3);
    ctx.textAlign = 'left';
  }
}

function drawPalm(ctx, palm) {
  const { x, y, s } = palm;
  ctx.strokeStyle = '#8a6d3b';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 3 * s, y - 7 * s);
  ctx.stroke();
  ctx.strokeStyle = '#2f9e44';
  ctx.lineWidth = 2 * s;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 3 * s, y - 7 * s);
    ctx.quadraticCurveTo(
      x + 3 * s + Math.cos(a) * 9 * s, y - 7 * s + Math.sin(a) * 6 * s - 2,
      x + 3 * s + Math.cos(a) * 14 * s, y - 7 * s + Math.sin(a) * 10 * s + 3 * s,
    );
    ctx.stroke();
  }
}

function drawCar(ctx, car, night) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const hw = car.w / 2;
  const hh = car.h / 2;
  ctx.fillStyle = 'rgba(15,18,20,0.3)';
  ctx.beginPath();
  ctx.roundRect(-hw + 3, -hh + 4, car.w, car.h, 6);
  ctx.fill();
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, car.w, car.h, 6);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#2b4acb';
    ctx.fillRect(-6, -hh, 13, car.h);
    const flash = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4757' : '#54a0ff';
    ctx.fillRect(-7, -4, 5, 8);
    ctx.fillStyle = flash ? '#54a0ff' : '#ff4757';
    ctx.fillRect(2, -4, 5, 8);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-4, -3, 8, 6);
  }
  // Cabin and glass.
  ctx.fillStyle = 'rgba(18, 24, 34, 0.88)';
  ctx.beginPath();
  ctx.roundRect(-hw * 0.42, -hh * 0.78, car.w * 0.5, car.h * 0.78, 3);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14161a';
  for (const [wx, wy] of [[-hw + 7, -hh - 1], [hw - 7, -hh - 1], [-hw + 7, hh - 3], [hw - 7, hh - 3]]) {
    ctx.fillRect(wx - 4, wy, 8, 4);
  }
  // Headlights after dark.
  if (night) {
    const grad = ctx.createLinearGradient(hw, 0, hw + 74, 0);
    grad.addColorStop(0, 'rgba(255, 240, 180, 0.30)');
    grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(hw, -hh + 3);
    ctx.lineTo(hw + 74, -hh - 8);
    ctx.lineTo(hw + 74, hh + 8);
    ctx.lineTo(hw, hh - 3);
    ctx.closePath();
    ctx.fill();
  }
  if (car.hp <= 0) {
    ctx.fillStyle = 'rgba(20,20,22,0.35)';
    ctx.beginPath();
    ctx.roundRect(-hw, -hh, car.w, car.h, 6);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped, isPlayer) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(15,18,20,0.28)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.dead) {
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.roundRect(-11, -5, 22, 10, 5);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(13, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const stride = Math.sin(ped.phase || 0) * 3;
  ctx.strokeStyle = '#2d3436';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ped.angle + 0.5) * (5 + stride), Math.sin(ped.angle + 0.5) * (5 + stride));
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ped.angle - 0.5) * (5 - stride), Math.sin(ped.angle - 0.5) * (5 - stride));
  ctx.stroke();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 2, Math.sin(ped.angle) * 2, 4.4, 0, Math.PI * 2);
  ctx.fill();
  if (ped.role === 'officer') {
    ctx.fillStyle = '#1d3573';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 2, Math.sin(ped.angle) * 2, 4.8, 0, Math.PI);
    ctx.fill();
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (ped.role === 'passenger' || ped.role === 'giver') {
    ctx.fillStyle = PALETTE.mission;
    ctx.font = `900 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -16 + Math.sin(performance.now() / 300) * 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** A gold beacon over the mission target, readable from anywhere on the street. */
function drawMarker(ctx, state, x, y, color) {
  const pulse = 1 + Math.sin(state.time * 4.4) * 0.12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 24 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  const grad = ctx.createLinearGradient(0, y - 320, 0, y);
  grad.addColorStop(0, 'rgba(255, 198, 26, 0)');
  grad.addColorStop(1, 'rgba(255, 198, 26, 0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 9, y - 320, 18, 320);
  ctx.fillStyle = color;
  ctx.beginPath();
  const bob = Math.sin(state.time * 4.4) * 4;
  ctx.moveTo(x, y - 44 + bob);
  ctx.lineTo(x - 10, y - 58 + bob);
  ctx.lineTo(x + 10, y - 58 + bob);
  ctx.closePath();
  ctx.fill();
}

function drawWorld(ctx, state) {
  const city = state.city;
  const cam = state.camera;
  const night = isNight(state.clockMinutes);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // The bay, the sand, the promenade.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(cam.x - 20, cam.y - 20, VIEW.width + 40, VIEW.height + 40);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 26; i += 1) {
    const wx = ((i * 173 + Math.floor(state.time * 12)) % (VIEW.width + 90)) + cam.x - 45;
    const wy = city.waterY + 24 + ((i * 67) % (city.height - city.waterY - 40));
    if (wy > cam.y - 10 && wy < cam.y + VIEW.height + 10) ctx.fillRect(wx, wy, 26, 2);
  }
  ctx.fillStyle = '#69a86b';
  ctx.fillRect(0, 0, city.width, city.roadsBottom + CITY.promenade);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, city.sandY, city.width, city.waterY - city.sandY);
  ctx.fillStyle = PALETTE.promenade;
  ctx.fillRect(0, city.roadsBottom, city.width, CITY.promenade);
  // Blocks: sidewalks, parks.
  for (const block of city.blocks) {
    ctx.fillStyle = block.park ? PALETTE.park : PALETTE.sidewalk;
    ctx.fillRect(block.x, block.y, block.size, block.size);
  }
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of city.vRoads) ctx.fillRect(rx - CITY.road / 2, 0, CITY.road, city.roadsBottom);
  for (const ry of city.hRoads) ctx.fillRect(0, ry - CITY.road / 2, city.width, CITY.road);
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 14]);
  for (const rx of city.vRoads) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, city.roadsBottom); ctx.stroke(); }
  for (const ry of city.hRoads) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(city.width, ry); ctx.stroke(); }
  ctx.setLineDash([]);
  // Crosswalks at every crossing.
  ctx.fillStyle = 'rgba(216,212,196,0.5)';
  for (const ix of city.intersections) {
    ctx.fillRect(ix.x - CITY.road / 2 + 3, ix.y - 12, 5, 24);
    ctx.fillRect(ix.x + CITY.road / 2 - 8, ix.y - 12, 5, 24);
    ctx.fillRect(ix.x - 12, ix.y - CITY.road / 2 + 3, 24, 5);
    ctx.fillRect(ix.x - 12, ix.y + CITY.road / 2 - 8, 24, 5);
  }
  // POI door dots.
  for (const poi of city.pois) {
    ctx.fillStyle = poi.type === 'police' ? '#54a0ff' : poi.type === 'hospital' ? '#ff6b81' : '#2ed573';
    ctx.beginPath();
    ctx.arc(poi.x, poi.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
  }
  for (const palm of city.palms) {
    if (palm.x < cam.x - 40 || palm.x > cam.x + VIEW.width + 40 || palm.y < cam.y - 40 || palm.y > cam.y + VIEW.height + 40) continue;
    drawPalm(ctx, palm);
  }
  for (const b of city.buildings) {
    if (b.x + b.w < cam.x - 60 || b.x > cam.x + VIEW.width + 60 || b.y + b.h < cam.y - 120 || b.y > cam.y + VIEW.height + 60) continue;
    drawBuilding(ctx, b);
  }
  // The job's beacon, and the fixer's when the street is quiet.
  if (state.mission && state.mission.target) {
    drawMarker(ctx, state, state.mission.target.x, state.mission.target.y, PALETTE.mission);
  }
  // Cars, people, the player.
  for (const car of state.cars) drawCar(ctx, car, night);
  for (const ped of state.peds) {
    if (ped.role === 'gone') continue;
    drawPed(ctx, ped, false);
  }
  if (!state.player.car) drawPed(ctx, { ...state.player, role: 'player', shirt: PALETTE.player, skin: '#e0ac69', phase: state.playerPhase || 0 }, true);
  else {
    // A ring under the driven car so the eye keeps it in a crowd.
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.player.car.x, state.player.car.y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Tracers and particles and floaters.
  for (const t of state.tracers) {
    ctx.strokeStyle = t.color;
    ctx.globalAlpha = 1 - t.t / t.life;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const p of state.particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = `800 15px ${FONT}`;
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    ctx.globalAlpha = 1 - f.t / f.life;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.restore();

  // The sky over everything, and lamp glow after dark.
  const tint = skyTint(state.clockMinutes);
  if (tint.alpha > 0.01) {
    ctx.fillStyle = tint.color;
    ctx.globalAlpha = tint.alpha;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.globalAlpha = 1;
  }
  if (night) {
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    for (const lamp of state.city.lamps) {
      if (lamp.x < cam.x - 60 || lamp.x > cam.x + VIEW.width + 60 || lamp.y < cam.y - 60 || lamp.y > cam.y + VIEW.height + 60) continue;
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 34);
      g.addColorStop(0, 'rgba(255, 214, 130, 0.34)');
      g.addColorStop(1, 'rgba(255, 214, 130, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(lamp.x - 34, lamp.y - 34, 68, 68);
    }
    ctx.restore();
  }
  // Hurt vignette.
  if (state.player.hurtTimer > 0) {
    ctx.fillStyle = `rgba(214, 48, 49, ${0.22 * (state.player.hurtTimer / 0.25)})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

/** An arrow at the screen edge pointing at the mission target, with its distance. */
function drawEdgeArrow(ctx, state) {
  if (!state.mission || !state.mission.target) return;
  const cam = state.camera;
  const t = state.mission.target;
  const sx = t.x - cam.x;
  const sy = t.y - cam.y;
  if (sx > 30 && sx < VIEW.width - 30 && sy > 30 && sy < VIEW.height - 30) return;
  const cx = VIEW.width / 2;
  const cy = VIEW.height / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ex = clamp(sx, 44, VIEW.width - 44);
  const ey = clamp(sy, 44, VIEW.height - 44);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = PALETTE.mission;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const p = state.player;
  const d = Math.round(Math.hypot(t.x - (p.car ? p.car.x : p.x), t.y - (p.car ? p.car.y : p.y)) / 10);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${d}m`, ex, ey + 26);
  ctx.textAlign = 'left';
}

function bigPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = `900 74px ${FONT}`;
  ctx.fillText(title, VIEW.width / 2, 218);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `18px ${FONT}`;
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 286 + i * 30));
  ctx.textAlign = 'left';
}

function statsLines(state) {
  return [
    `Missions done: ${state.missionsDone} of 7 · Money earned: $${state.stats.earned}`,
    `Cars stolen: ${state.stats.carsStolen} · Shots fired: ${state.stats.shotsFired} · Distance: ${Math.round(state.stats.distance / 40)} blocks`,
    `Cash on hand: $${state.player.money}`,
  ];
}

export function createRenderer(canvas) {
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');
  return {
    draw(state) {
      drawWorld(ctx, state);
      const screen = state.screen;
      if (screen === SCREEN_TITLE) {
        const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
        grad.addColorStop(0, 'rgba(10, 8, 20, 0.62)');
        grad.addColorStop(0.55, 'rgba(10, 8, 20, 0.18)');
        grad.addColorStop(1, 'rgba(10, 8, 20, 0.66)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd23f';
        ctx.font = `900 92px ${FONT}`;
        ctx.fillText('PALM BAY HEAT', VIEW.width / 2, 168);
        ctx.fillStyle = PALETTE.text;
        ctx.font = `600 21px ${FONT}`;
        ctx.fillText('An open-world crime story in a sun-soaked bay city — every street, every car, yours to take.', VIEW.width / 2, 208);
        ctx.font = `17px ${FONT}`;
        ctx.fillText('Rio owes the Cangrejo crew. Seven jobs for the fixers of Palm Bay stand between Rio and a clean name.', VIEW.width / 2, 252);
        ctx.fillText('Walk it or drive it. Outrun the Comisaría, thread the Sprint, and hold the Mirador yard.', VIEW.width / 2, 280);
        ctx.font = `700 24px ${FONT}`;
        ctx.fillStyle = '#2ed573';
        ctx.fillText(state.hasSave ? 'ENTER — New game      C — Continue' : 'ENTER — Start the story', VIEW.width / 2, 356);
        ctx.fillStyle = 'rgba(245,242,232,0.85)';
        ctx.font = `15px ${FONT}`;
        ctx.fillText('WASD / arrows — move & drive · E — enter car, talk, use · Mouse / F — shoot · Shift — sprint · Space — handbrake', VIEW.width / 2, 640);
        ctx.fillText('P — pause · M — mute · Your run saves itself after every job', VIEW.width / 2, 666);
        ctx.textAlign = 'left';
      } else if (screen === SCREEN_PAUSED) {
        drawHUD(ctx, { ...state, toast: null });
        bigPanel(ctx, 'PAUSED', ['The bay waits.', 'P or ENTER — back to the street', ...statsLines(state)], '#f5f2e8');
      } else if (screen === SCREEN_BUSTED) {
        drawHUD(ctx, { ...state, toast: null });
        bigPanel(ctx, 'BUSTED', ['The Comisaría thanks you for your donation.', ...statsLines(state), 'ENTER — back on the street'], '#ff4757');
      } else if (screen === SCREEN_WASTED) {
        drawHUD(ctx, { ...state, toast: null });
        bigPanel(ctx, 'WASTED', ['Hospital del Litoral patches Rio up — and sends the bill.', ...statsLines(state), 'ENTER — back on the street'], '#e17055');
      } else if (screen === SCREEN_COMPLETE) {
        drawHUD(ctx, { ...state, toast: null });
        bigPanel(ctx, 'THE BAY IS YOURS', ['Every job done. The debt is ash, and Palm Bay keeps Rio\'s name in gold.', ...statsLines(state), 'ENTER — keep roaming the bay'], '#ffd23f');
      } else {
        drawHUD(ctx, state);
        drawEdgeArrow(ctx, state);
      }
    },
  };
}
