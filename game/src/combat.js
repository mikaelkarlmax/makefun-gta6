// Combat, kept simple and loud: a punch for whoever is close, a hitscan shot for
// whoever the crosshair holds, tracers and sparks so every hit reads. The player's
// gunfire is a crime the bay can hear; police gunfire lives in police.js.
import { PLAYER, WANTED } from './config.js';
import { damagePed, scarePeds } from './peds.js';
import { carRadius, damageCar } from './vehicles.js';
import { addCrime, burst } from './world.js';
import { distance } from './random.js';

/** How far a point sits along a ray, and how far off it: for hitscan tests. */
function rayHit(ox, oy, angle, x, y, radius) {
  const dx = x - ox;
  const dy = y - oy;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  if (along < 0 || along > PLAYER.shotRange) return -1;
  const off = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
  return off <= radius ? along : -1;
}

/** Fire once toward the aim point (or throw a punch, if someone is in reach). */
export function playerShoot(state, aimX, aimY, audio) {
  const player = state.player;
  const ox = player.car ? player.car.x : player.x;
  const oy = player.car ? player.car.y : player.y;
  const angle = Math.atan2(aimY - oy, aimX - ox);
  if (!player.car) player.angle = angle;

  // A punch: anyone standing in reach takes it instead of a bullet.
  if (!player.car) {
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (distance(ox, oy, ped.x, ped.y) < PLAYER.punchRange && Math.abs(((Math.atan2(ped.y - oy, ped.x - ox) - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.2) {
        damagePed(state, ped, PLAYER.punchDamage, true);
        audio.punch();
        scarePeds(state, ped.x, ped.y, 120);
        if (ped.role === 'officer') addCrime(state, WANTED.crimes.hurtOfficer, ped.x, ped.y, false);
        else addCrime(state, 0.5, ped.x, ped.y, false);
        player.shotTimer = 0.3;
        return;
      }
    }
  }

  player.shotTimer = PLAYER.shotCooldown;
  state.stats.shotsFired += 1;
  audio.shot();
  burst(state, ox + Math.cos(angle) * 16, oy + Math.sin(angle) * 16, '#ffd76a', 3, 60, 0.12, 2);
  addCrime(state, WANTED.crimes.gunshot, ox, oy, false);
  scarePeds(state, ox, oy, 170);

  // The nearest thing the ray touches takes the bullet.
  let bestAlong = Infinity;
  let hitPed = null;
  let hitCar = null;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const along = rayHit(ox, oy, angle, ped.x, ped.y, 12);
    if (along > 0 && along < bestAlong) { bestAlong = along; hitPed = ped; hitCar = null; }
  }
  for (const car of state.cars) {
    if (car === player.car) continue;
    const along = rayHit(ox, oy, angle, car.x, car.y, carRadius(car) + 7);
    if (along > 0 && along < bestAlong) { bestAlong = along; hitCar = car; hitPed = null; }
  }
  const endX = ox + Math.cos(angle) * (bestAlong === Infinity ? PLAYER.shotRange * 0.6 : bestAlong);
  const endY = oy + Math.sin(angle) * (bestAlong === Infinity ? PLAYER.shotRange * 0.6 : bestAlong);
  state.tracers.push({ x1: ox, y1: oy, x2: endX, y2: endY, t: 0, life: 0.08, color: '#ffe9a8' });

  if (hitPed) {
    const wasAlive = !hitPed.dead;
    damagePed(state, hitPed, PLAYER.shotDamage, true);
    if (hitPed.role === 'officer') {
      addCrime(state, hitPed.dead && wasAlive ? WANTED.crimes.killOfficer : WANTED.crimes.hurtOfficer, hitPed.x, hitPed.y, true);
    } else if (hitPed.dead && wasAlive) {
      addCrime(state, WANTED.crimes.killPed, hitPed.x, hitPed.y, false);
    }
    if (state.mission && state.mission.onPedHit) state.mission.onPedHit(hitPed);
  } else if (hitCar) {
    damageCar(state, hitCar, PLAYER.shotDamage * 0.8, true);
    burst(state, endX, endY, '#ffd76a', 5, 110, 0.3, 2);
    if (hitCar.driver === 'police' || hitCar.driver === 'roadblock') {
      addCrime(state, WANTED.crimes.hurtOfficer, hitCar.x, hitCar.y, true);
    }
    if (state.mission && state.mission.onCarHit) state.mission.onCarHit(hitCar);
  }
}

/** The per-step combat clock: cooldowns only; the shooting itself is an input act. */
export function updateCombat(state, dt) {
  state.player.shotTimer = Math.max(0, state.player.shotTimer - dt);
  state.player.hurtTimer = Math.max(0, state.player.hurtTimer - dt);
}
