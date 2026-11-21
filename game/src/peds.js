// Pedestrians: Palm Bay walks on its sidewalks. Civilians stroll corner to corner,
// run from gunfire and traffic, and remember being wronged. Officers and mission
// passengers are pedestrians too, but their orders come from police.js and
// missions.js; this file owns the walking, the fleeing and the falling.
import { PEDS } from './config.js';
import { randomSidewalkPoint } from './city.js';
import { moveCircle } from './city.js';
import { addCrime, burst } from './world.js';
import { distance } from './random.js';

const SHIRTS = ['#e17055', '#00b894', '#0984e3', '#fdcb6e', '#e84393', '#dfe6e9', '#74b9ff', '#55efc4', '#fab1a0', '#a29bfe'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/** A person at a place. Roles: walker, officer, passenger, giver. */
export function createPed(rng, x, y, role) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2),
    hp: role === 'officer' ? 60 : PEDS.hp,
    role, dead: false, deadTimer: 0,
    shirt: role === 'officer' ? '#2b4acb' : rng.pick(SHIRTS),
    skin: rng.pick(SKINS),
    tx: x, ty: y, // where the feet are headed
    fleeTimer: 0, fleeX: 0, fleeY: 0,
    hitByPlayer: false, boarded: false, phase: rng.range(0, 6),
  };
}

/** Fill the sidewalks with life. */
export function spawnWalkers(state, count) {
  const { rng, city } = state;
  for (let i = 0; i < count; i += 1) {
    const p = randomSidewalkPoint(rng, city);
    const ped = createPed(rng, p.x, p.y, 'walker');
    pickCorner(state, ped);
    state.peds.push(ped);
  }
}

/** Send a walker toward a fresh street corner. */
function pickCorner(state, ped) {
  const p = randomSidewalkPoint(state.rng, state.city);
  ped.tx = p.x;
  ped.ty = p.y;
}

/** Something frightening happened here: nearby walkers run from it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.dead || ped.role !== 'walker') continue;
    if (distance(x, y, ped.x, ped.y) < radius) {
      ped.fleeTimer = Math.max(ped.fleeTimer, 2.6);
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}

/** Damage a person; the fallen stay where they fell for a while. */
export function damagePed(state, ped, amount, byPlayer) {
  if (ped.dead) return;
  ped.hp -= amount;
  burst(state, ped.x, ped.y, '#c0392b', 5, 90, 0.4, 2);
  if (ped.hp <= 0) {
    ped.dead = true;
    ped.deadTimer = 24;
    scarePeds(state, ped.x, ped.y, 190);
  }
}

/** One step for every civilian: stroll, flee, and watch out for cars. */
export function updateWalkers(state, dt) {
  const player = state.player;
  for (const ped of state.peds) {
    if (ped.role !== 'walker') continue;
    if (ped.dead) {
      ped.deadTimer -= dt;
      continue;
    }
    ped.phase += dt * (ped.fleeTimer > 0 ? 11 : 6);
    let tx = ped.tx;
    let ty = ped.ty;
    let speed = PEDS.walkSpeed;
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
      tx = ped.x + Math.cos(away) * 120;
      ty = ped.y + Math.sin(away) * 120;
      speed = PEDS.fleeSpeed;
    } else if (distance(ped.x, ped.y, tx, ty) < 10) {
      pickCorner(state, ped);
      continue;
    }
    const want = Math.atan2(ty - ped.y, tx - ped.x);
    ped.angle = want;
    moveCircle(state.city, ped, Math.cos(want) * speed * dt, Math.sin(want) * speed * dt, 9, true);
    // Traffic is the real danger on these streets.
    for (const car of state.cars) {
      if (Math.abs(car.speed) < 46) continue;
      if (distance(ped.x, ped.y, car.x, car.y) < 21) {
        const byPlayer = player.car === car;
        damagePed(state, ped, 70, byPlayer);
        ped.x += Math.cos(car.angle) * 14;
        ped.y += Math.sin(car.angle) * 14;
        if (byPlayer && !ped.hitByPlayer) {
          ped.hitByPlayer = true;
          addCrime(state, 1.6, ped.x, ped.y, false);
          state.toast = { text: 'You hit a pedestrian!', sub: 'The bay is watching.', until: state.time + 2 };
        }
        scarePeds(state, ped.x, ped.y, 160);
        break;
      }
      if (distance(ped.x, ped.y, car.x, car.y) < 52 && Math.abs(car.speed) > 130) {
        ped.fleeTimer = Math.max(ped.fleeTimer, 0.9);
        ped.fleeX = car.x;
        ped.fleeY = car.y;
      }
    }
  }
  // Clear the long-fallen so the streets stay busy.
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.dead && ped.deadTimer <= 0 && ped.role === 'walker') {
      state.peds.splice(i, 1);
      const p = randomSidewalkPoint(state.rng, state.city);
      const fresh = createPed(state.rng, p.x, p.y, 'walker');
      pickCorner(state, fresh);
      state.peds.push(fresh);
    }
  }
  // Keep the crowds near the player: teleport the far ones to nearer corners.
  for (const ped of state.peds) {
    if (ped.role !== 'walker' || ped.dead) continue;
    if (distance(ped.x, ped.y, player.x, player.y) > 1150) {
      const p = randomSidewalkPoint(state.rng, state.city);
      if (distance(p.x, p.y, player.x, player.y) < 700) {
        ped.x = p.x;
        ped.y = p.y;
        pickCorner(state, ped);
      }
    }
  }
}
