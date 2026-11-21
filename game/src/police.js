// The Palm Bay police: heat that cools when nobody is watching, patrol cars that
// hunt in numbers set by the wanted stars, officers who get out and give chase on
// foot, roadblocks at four stars, and the bust meter that ends a chase when the
// law has the player cornered and slow.
import { POLICE, WANTED } from './config.js';
import { nearestIntersection, randomIntersection } from './city.js';
import { createPed } from './peds.js';
import { createCar, steerCar, damageCar } from './vehicles.js';
import { distance } from './random.js';

/** Where the player is for police purposes: in the car when driving. */
export function playerPos(state) {
  const p = state.player;
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

function policeCars(state) {
  return state.cars.filter((c) => c.driver === 'police' || c.driver === 'roadblock');
}

function officers(state) {
  return state.peds.filter((p) => p.role === 'officer' && !p.dead);
}

/** Heat, stars, spawning and cooling: the wanted system in one step. */
export function updateWanted(state, dt) {
  const pos = playerPos(state);
  let seen = false;
  for (const car of policeCars(state)) {
    if (distance(pos.x, pos.y, car.x, car.y) < WANTED.seenRadius) { seen = true; break; }
  }
  if (!seen) {
    for (const cop of officers(state)) {
      if (distance(pos.x, pos.y, cop.x, cop.y) < WANTED.seenRadius * 0.7) { seen = true; break; }
    }
  }
  if (seen) state.seenTimer = 0;
  else {
    state.seenTimer += dt;
    if (state.seenTimer > WANTED.coolDelay && state.heat > 0) {
      state.heat = Math.max(0, state.heat - WANTED.coolRate * dt);
    }
  }
  state.stars = state.heat <= 0.04 ? 0 : Math.min(WANTED.max, Math.ceil(state.heat));

  // Numbers: one car per star, plus one, capped — and none when the bay is calm.
  const wanted = state.stars === 0 ? 0 : Math.min(6, state.stars + 1);
  const cars = policeCars(state).filter((c) => c.driver === 'police');
  if (cars.length < wanted) {
    const spot = randomIntersection(state.rng, state.city, pos.x, pos.y, POLICE.spawnDistance, POLICE.spawnDistance + 220);
    const car = createCar(state.rng, 'police', spot.x, spot.y, Math.atan2(pos.y - spot.y, pos.x - spot.x), 'police');
    state.cars.push(car);
  } else if (cars.length > wanted) {
    const far = cars.find((c) => distance(pos.x, pos.y, c.x, c.y) > POLICE.despawnDistance);
    if (far) state.cars.splice(state.cars.indexOf(far), 1);
  }
  // Roadblocks at four stars: two cars across the road the player is running to.
  state.roadblockTimer = (state.roadblockTimer || 0) - dt;
  if (state.stars >= 4 && state.roadblockTimer <= 0 && !state.cars.some((c) => c.driver === 'roadblock')) {
    state.roadblockTimer = 26;
    const ahead = state.player.car
      ? { x: pos.x + Math.cos(state.player.car.angle) * 430, y: pos.y + Math.sin(state.player.car.angle) * 430 }
      : pos;
    const ix = nearestIntersection(state.city, ahead.x, ahead.y);
    for (const side of [-16, 16]) {
      const car = createCar(state.rng, 'police', ix.x + side, ix.y, Math.PI / 2, 'roadblock');
      state.cars.push(car);
    }
  }
  for (const car of state.cars) {
    if (car.driver === 'roadblock' && distance(pos.x, pos.y, car.x, car.y) < 210) car.driver = 'police';
  }
}

/** Pursuit driving, officers on foot, police gunfire and the bust meter. */
export function updatePolice(state, dt) {
  const pos = playerPos(state);
  const player = state.player;
  let bustPressure = 0;

  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    if (car.hp <= 0) {
      car.speed = 0;
      // A wrecked patrol car still gives up its officer, once.
      if (!car.officerOut && officers(state).length < 4) {
        car.officerOut = true;
        state.peds.push(createPed(state.rng, car.x + 16, car.y, 'officer'));
      }
      continue;
    }
    const d = distance(pos.x, pos.y, car.x, car.y);
    const top = 400 + state.stars * 9;
    steerCar(state, car, dt, pos.x, pos.y, d > 300 ? top : top * 0.92, 3.1);
    // Cornered: a patrol car alongside a crawling player fills the bust meter.
    if (player.car && Math.abs(player.car.speed) < 30 && d < 56) bustPressure = Math.max(bustPressure, 0.55);
    if (!player.car && d < 44) bustPressure = Math.max(bustPressure, 0.8);
    // Officers step out when the chase goes on foot.
    if (!player.car && d < 120 && d > 30 && !car.officerOut && officers(state).length < 4 && state.rng.chance(0.25 * dt)) {
      car.officerOut = true;
      state.peds.push(createPed(state.rng, car.x, car.y + 14, 'officer'));
    }
    if (car.officerOut && player.car) car.officerOut = false;
  }

  for (const cop of officers(state)) {
    const d = distance(pos.x, pos.y, cop.x, cop.y);
    if (d > POLICE.despawnDistance) {
      cop.dead = true; // walks off the story; updateWalkers leaves officers alone
      cop.role = 'gone';
      continue;
    }
    cop.phase += dt * 10;
    if (d > 30) {
      const want = Math.atan2(pos.y - cop.y, pos.x - cop.x);
      cop.angle = want;
      const step = POLICE.officerSpeed * dt;
      const nx = cop.x + Math.cos(want) * step;
      const ny = cop.y + Math.sin(want) * step;
      if (!state.city.buildings.some((b) => nx > b.x - 8 && nx < b.x + b.w + 8 && ny > b.y - 8 && ny < b.y + b.h + 8)) {
        cop.x = nx;
        cop.y = ny;
      }
    }
    if (!player.car && d < POLICE.bustRadius) bustPressure = Math.max(bustPressure, 1);
    // Police gunfire: careful, telegraphed, and only at two stars or more.
    cop.shotTimer = (cop.shotTimer || 0) - dt;
    if (state.stars >= 2 && d < POLICE.shotRange && d > 44 && cop.shotTimer <= 0) {
      cop.shotTimer = POLICE.shotInterval * state.rng.range(0.8, 1.3);
      state.tracers.push({ x1: cop.x, y1: cop.y, x2: pos.x, y2: pos.y, t: 0, life: 0.09, color: '#ffd76a' });
      if (state.rng.chance(0.42)) hurtPlayer(state, POLICE.shotDamage, true);
    }
  }

  if (bustPressure > 0) state.bustMeter = Math.min(1, state.bustMeter + (bustPressure * dt) / POLICE.bustSeconds);
  else state.bustMeter = Math.max(0, state.bustMeter - dt * 0.5);
  if (state.bustMeter >= 1 && !state.pendingEnd) state.pendingEnd = 'busted';
}

/** Damage the player (in the car, the car soaks most of it). */
export function hurtPlayer(state, amount, fromShot) {
  const player = state.player;
  if (player.car) {
    damageCar(state, player.car, amount * 1.6, false);
    if (state.rng.chance(0.3)) player.hp -= amount * 0.4;
  } else {
    player.hp -= amount;
  }
  player.hurtTimer = 0.25;
  if (player.hp <= 0 && !state.pendingEnd) {
    player.hp = 0;
    state.pendingEnd = 'wasted';
  }
}
