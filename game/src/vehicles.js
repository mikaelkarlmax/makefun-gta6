// Cars: the player's driving physics, the traffic that flows intersection to
// intersection keeping to the right, parked cars waiting to be borrowed, and the
// collisions between all of them and the city. Police driving lives in police.js
// but steers through the same helpers.
import { CAR_KINDS, CITY, TRAFFIC } from './config.js';
import { circleHitsBuilding, moveCircle } from './city.js';
import { addCrime, burst } from './world.js';
import { angleDelta, clamp, distance } from './random.js';

const PAINTS = ['#e74c3c', '#f39c12', '#f5f0e6', '#3498db', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#fd79a8', '#636e72', '#fdcb6e'];
const TAXI_PAINT = '#f7b731';

/** A car of a kind at a place. `driver` is traffic, parked, police or player. */
export function createCar(rng, kind, x, y, angle, driver) {
  const spec = CAR_KINDS[kind];
  return {
    x, y, angle, speed: 0,
    w: spec.w, h: spec.h, kind,
    color: kind === 'police' ? '#f2f3f4' : kind === 'taxi' ? TAXI_PAINT : rng.pick(PAINTS),
    driver, hp: spec.hp, maxHp: spec.hp,
    tx: x, ty: y, // traffic target intersection
    honkTimer: 0, stuckTimer: 0, hitTimer: 0, flash: rng.range(0, 6),
    roadblock: false, smokeTimer: 0,
  };
}

function pitch() { return CITY.block + CITY.road; }

/** Choose the next intersection for a traffic car: a neighbour, rarely a U-turn. */
function nextTarget(rng, city, car) {
  const p = pitch();
  const options = [];
  for (const [dx, dy] of [[p, 0], [-p, 0], [0, p], [0, -p]]) {
    const nx = car.tx + dx;
    const ny = car.ty + dy;
    if (nx < city.vRoads[0] - 1 || nx > city.vRoads[city.vRoads.length - 1] + 1) continue;
    if (ny < city.hRoads[0] - 1 || ny > city.hRoads[city.hRoads.length - 1] + 1) continue;
    const back = Math.abs(nx - car.px) < 2 && Math.abs(ny - car.py) < 2;
    if (!back || rng.chance(0.08)) options.push({ x: nx, y: ny });
  }
  const t = options.length ? rng.pick(options) : { x: car.px, y: car.py };
  car.px = car.tx;
  car.py = car.ty;
  car.tx = t.x;
  car.ty = t.y;
}

/** Scatter moving traffic over the grid. */
export function spawnTraffic(state, count) {
  const { rng, city } = state;
  for (let i = 0; i < count; i += 1) {
    const ix = rng.pick(city.intersections);
    const kind = rng.pick(['compact', 'sedan', 'sedan', 'taxi', 'van', 'sports']);
    const car = createCar(rng, kind, ix.x, ix.y, 0, 'traffic');
    car.px = ix.x;
    car.py = ix.y;
    car.tx = ix.x;
    car.ty = ix.y;
    nextTarget(rng, city, car);
    car.angle = Math.atan2(car.ty - car.y, car.tx - car.x);
    state.cars.push(car);
  }
}

/** Parked cars along the kerbs: unlocked, mostly, and all of them borrowable. */
export function spawnParked(state, count) {
  const { rng, city } = state;
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 30) {
    guard += 1;
    const ix = rng.pick(city.intersections);
    const alongX = rng.chance(0.5);
    const off = CITY.road / 2 + 13;
    const x = ix.x + (alongX ? rng.range(-90, 90) : (rng.chance(0.5) ? -off : off));
    const y = ix.y + (alongX ? (rng.chance(0.5) ? -off : off) : rng.range(-90, 90));
    if (circleHitsBuilding(city, x, y, 16)) continue;
    if (state.cars.some((c) => distance(x, y, c.x, c.y) < 54)) continue;
    const kind = rng.pick(['compact', 'sedan', 'sports', 'van', 'compact']);
    const car = createCar(rng, kind, x, y, alongX ? 0 : Math.PI / 2, 'parked');
    if (rng.chance(0.5)) car.angle += Math.PI;
    state.cars.push(car);
    placed += 1;
  }
}

/** The collision radius used for every car, whatever its paint. */
export function carRadius(car) { return car.h * 0.66; }

/**
 * Steer a car toward a point with a speed cap, sliding along buildings.
 * Returns the speed actually made, so callers can tell a ram from a roll.
 */
export function steerCar(state, car, dt, targetX, targetY, maxSpeed, turnRate) {
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  const delta = angleDelta(car.angle, want);
  const spec = CAR_KINDS[car.kind];
  car.angle += clamp(delta, -turnRate * dt, turnRate * dt);
  const accel = Math.abs(delta) > 1.9 ? -spec.accel * 0.4 : spec.accel;
  car.speed = clamp(car.speed + accel * dt, 0, maxSpeed);
  if (Math.abs(delta) > 2.4) car.speed = Math.max(0, car.speed - spec.accel * dt);
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const moved = moveCircle(state.city, car, dx, dy, carRadius(car), false);
  if (moved < Math.abs(dx) + Math.abs(dy) - 0.6 && car.speed > 60) {
    car.speed *= 0.4; // nose against a wall: shed the speed
  }
  return car.speed;
}

/** Is something solid close ahead of a car? Used by traffic to brake in time. */
function blockedAhead(state, car) {
  const fx = car.x + Math.cos(car.angle) * TRAFFIC.brakeDistance;
  const fy = car.y + Math.sin(car.angle) * TRAFFIC.brakeDistance;
  for (const other of state.cars) {
    if (other === car) continue;
    if (distance(fx, fy, other.x, other.y) < 26) return other;
  }
  const p = state.player;
  if (!p.car && distance(fx, fy, p.x, p.y) < 24) return 'ped';
  return null;
}

/** One step of traffic: follow the lane to the next intersection, brake for trouble. */
export function updateTraffic(state, car, dt) {
  if (car.hp <= 0) { car.speed = 0; return; }
  const dx = car.tx - car.px;
  const dy = car.ty - car.py;
  const len = Math.hypot(dx, dy) || 1;
  // Right-hand lane: aim beside the intersection centre, on the driver's right.
  const aimX = car.tx + (-dy / len) * 13;
  const aimY = car.ty + (dx / len) * 13;
  if (distance(car.x, car.y, car.tx, car.ty) < 40) nextTarget(state.rng, state.city, car);
  const blocker = blockedAhead(state, car);
  if (blocker) {
    car.speed = Math.max(0, car.speed - 420 * dt);
    car.honkTimer -= dt;
    if (car.honkTimer <= 0 && car.speed < 12) {
      car.honkTimer = state.rng.range(1.4, 3.4);
      car.wantHonk = true;
    }
    const mx = Math.cos(car.angle) * car.speed * dt;
    const my = Math.sin(car.angle) * car.speed * dt;
    moveCircle(state.city, car, mx, my, carRadius(car), false);
    return;
  }
  steerCar(state, car, dt, aimX, aimY, TRAFFIC.speed * state.trafficFlow, 2.2);
}

/** The player's car: throttle, steering that bites with speed, a real handbrake. */
export function updatePlayerCar(state, car, dt, input) {
  const spec = CAR_KINDS[car.kind];
  const throttle = -input.axisY();
  const steer = input.axisX();
  if (car.hp > 0) {
    if (throttle > 0) car.speed += spec.accel * dt;
    else if (throttle < 0) car.speed -= (car.speed > 4 ? spec.accel * 1.1 : spec.accel * 0.7) * dt;
  }
  car.speed -= car.speed * 0.55 * dt; // rolling drag
  if (input.brake()) car.speed -= car.speed * 3.2 * dt;
  const cap = car.hp > 0 ? spec.maxSpeed : 0;
  car.speed = clamp(car.speed, -spec.reverse, cap);
  if (Math.abs(car.speed) > 2) {
    const grip = clamp(Math.abs(car.speed) / 120, 0.25, 1);
    car.angle += steer * spec.turn * grip * dt * (car.speed < 0 ? -1 : 1);
  }
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const before = Math.abs(car.speed);
  const moved = moveCircle(state.city, car, dx, dy, carRadius(car), false);
  if (moved < Math.abs(dx) + Math.abs(dy) - 0.8 && before > 90) {
    damageCar(state, car, (before - 90) * 0.08, true);
    car.speed *= 0.3;
    state.crashShake = Math.min(9, before / 40);
    burst(state, car.x + Math.cos(car.angle) * 20, car.y + Math.sin(car.angle) * 20, '#ffd76a', 8, 130, 0.4, 2.4);
  }
  state.stats.distance += Math.abs(car.speed) * dt;
}

/** Hurt a car; at zero it smokes, stops, and stays where it died. */
export function damageCar(state, car, amount, byPlayer) {
  if (car.hp <= 0) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    burst(state, car.x, car.y, '#555c66', 16, 90, 0.9, 3.4);
    burst(state, car.x, car.y, '#ff9a3c', 10, 120, 0.5, 2.6);
  }
}

/** Cars push each other apart; hard knocks bend panels and, sometimes, the law notices. */
export function collideCars(state, dt) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const d = distance(a.x, a.y, b.x, b.y);
      const min = carRadius(a) + carRadius(b) + 6;
      if (d === 0 || d >= min) continue;
      const push = (min - d) / 2;
      const nx = (b.x - a.x) / d;
      const ny = (b.y - a.y) / d;
      if (a.driver !== 'parked' && a.driver !== 'roadblock') moveCircle(state.city, a, -nx * push, -ny * push, carRadius(a), false);
      if (b.driver !== 'parked' && b.driver !== 'roadblock') moveCircle(state.city, b, nx * push, ny * push, carRadius(b), false);
      const closing = Math.abs(a.speed) + Math.abs(b.speed);
      if (closing > 130) {
        damageCar(state, a, closing * 0.03, false);
        damageCar(state, b, closing * 0.03, false);
        const playerInvolved = (state.player.car === a || state.player.car === b);
        if (playerInvolved) {
          state.crashShake = Math.min(8, closing / 46);
          if (a.hitTimer <= 0 && b.hitTimer <= 0) {
            addCrime(state, 0.35, state.player.car.x, state.player.car.y, false);
            a.hitTimer = 1.2;
            b.hitTimer = 1.2;
          }
        }
        a.speed *= 0.55;
        b.speed *= 0.55;
      }
    }
  }
  for (const car of cars) {
    car.hitTimer = Math.max(0, car.hitTimer - dt);
    car.honkTimer = Math.max(0, car.honkTimer - dt);
    if (car.hp > 0 && car.hp < 42) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.16;
        burst(state, car.x, car.y - 4, 'rgba(70,74,82,0.8)', 1, 22, 0.8, 3.6);
      }
    }
  }
}
