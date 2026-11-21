// The screenshot scenes behind ?shot=start|play|end. Each one builds the real
// world from the seed and plays the real rules forward — traffic flowing, a
// police pursuit steered by the pursuit code, a bust staged with the law at the
// player's shoulder — so the frame is what the game really looks like, and the
// same seed always gives the same frame.
import { STEP, VIEW } from './config.js';
import { spawnPopulation } from './population.js';
import { createPed } from './peds.js';
import { steerCar, updatePlayerCar, updateTraffic, collideCars, createCar } from './vehicles.js';
import { updateWalkers } from './peds.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE, createWorld, updateEffects } from './world.js';
import { clamp } from './random.js';

function settleTraffic(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    state.time += STEP;
    for (const car of state.cars) if (car.driver === 'traffic') updateTraffic(state, car, STEP);
    updateWalkers(state, STEP);
    updateEffects(state, STEP);
  }
}

function centreCamera(state, x, y) {
  state.camera.x = clamp(x - VIEW.width / 2, 0, Math.max(0, state.city.width - VIEW.width));
  state.camera.y = clamp(y - VIEW.height / 2, 0, Math.max(0, state.city.height - VIEW.height));
}

function stageStart(state) {
  state.clockMinutes = 17 * 60 + 32; // golden hour over the bay
  settleTraffic(state, 2.4);
  state.screen = SCREEN_TITLE;
  state.hasSave = false;
  state.camera.x = state.city.width / 2 - VIEW.width / 2;
  state.camera.y = state.city.height - VIEW.height - 250;
  return state;
}

function stagePlay(state) {
  state.clockMinutes = 17 * 60 + 38;
  state.missionIndex = 2;
  state.missionsDone = 2;
  state.stats.earned = 440;
  state.stats.carsStolen = 1;
  state.player.money = 640;
  state.player.hp = 84;
  // Rio is mid-getaway in the red coupé of Hot Metal, three stars up,
  // running east through Downtown with the law stacked up behind.
  const car = createCar(state.rng, 'sports', 916, 930, 0, 'player');
  car.color = '#d63031';
  car.stolen = true;
  car.speed = 300;
  state.cars.push(car);
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.heat = 3.2;
  state.stars = 3;
  for (const [x, y] of [[788, 928], [656, 944], [530, 914]]) {
    const cop = createCar(state.rng, 'police', x, y, 0, 'police');
    cop.speed = 315;
    state.cars.push(cop);
  }
  state.mission = {
    def: { title: 'Hot Metal', giver: 'Paz', reward: 340 },
    step: { type: 'goto', label: 'Bring the coupé to Taller Paz' },
    target: { x: 2646, y: 574, label: 'Bring the coupé to Taller Paz' },
    timeLeft: null, holdT: 0, pointIndex: 0, targetCar: car, passenger: null,
  };
  // Play the chase forward a breath so every car sits in a natural pose.
  const drive = { axisY: () => -1, axisX: () => 0, brake: () => false };
  for (let i = 0; i < 58; i += 1) {
    state.time += STEP;
    updatePlayerCar(state, car, STEP, drive);
    state.player.x = car.x;
    state.player.y = car.y;
    for (const c of state.cars) {
      if (c.driver === 'police') steerCar(state, c, STEP, car.x, car.y, 415, 3.1);
      else if (c.driver === 'traffic') updateTraffic(state, c, STEP);
    }
    updateWalkers(state, STEP);
    collideCars(state, STEP);
    updateEffects(state, STEP);
  }
  state.screen = SCREEN_PLAY;
  centreCamera(state, car.x + 120, car.y);
  return state;
}

function stageEnd(state) {
  state.clockMinutes = 18 * 60 + 6;
  state.missionsDone = 3;
  state.stats.earned = 1040;
  state.stats.carsStolen = 2;
  state.stats.shotsFired = 14;
  state.stats.distance = 2600;
  state.player.money = 512;
  state.player.hp = 46;
  state.player.x = 1212;
  state.player.y = 620;
  state.player.angle = -0.6;
  // The coupé died against the kerb; the law is already out of its cars.
  const car = createCar(state.rng, 'sports', 1252, 592, 0.35, 'parked');
  car.color = '#d63031';
  car.hp = 26;
  state.cars.push(car);
  for (const [x, y, a] of [[1152, 622, 0], [1276, 646, Math.PI]]) {
    const cop = createCar(state.rng, 'police', x, y, a, 'police');
    state.cars.push(cop);
  }
  const officer = createPed(state.rng, 1238, 644, 'officer');
  officer.angle = Math.atan2(state.player.y - officer.y, state.player.x - officer.x);
  state.peds.push(officer);
  settleTraffic(state, 1.2);
  state.screen = SCREEN_BUSTED;
  centreCamera(state, state.player.x, state.player.y);
  return state;
}

/**
 * Build the named scene (start, play or end; any other name is start) in a fresh
 * world and return it, ready for the renderer.
 */
export function stageShot(name, seed) {
  const state = createWorld(seed);
  spawnPopulation(state);
  if (name === 'play') return stagePlay(state);
  if (name === 'end') return stageEnd(state);
  return stageStart(state);
}
