// The living state of one run: the player, every car and pedestrian, the wanted
// heat, the clock, the camera, particles and floating messages — plus the crime
// ledger (who saw what, and how hot it makes the player) and the save file.
// Systems in the other files read and mutate this state; nothing here draws.
import { CLOCK, PLAYER, SAVE_KEY, WANTED } from './config.js';
import { buildCity } from './city.js';
import { createRandom, distance } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

/** A fresh run in a fresh city. The seed fixes the city and every spawn. */
export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const cafe = city.pois.find((p) => p.type === 'cafe');
  const state = {
    rng,
    city,
    seed,
    screen: SCREEN_TITLE,
    time: 0, // seconds of play this run
    clockMinutes: CLOCK.startMinutes,
    player: {
      x: cafe.x + 26, y: cafe.y + 30, angle: -Math.PI / 2,
      hp: PLAYER.maxHp, money: PLAYER.startMoney,
      car: null, // the car being driven, or null on foot
      shotTimer: 0, hurtTimer: 0, dead: false,
    },
    cars: [],
    peds: [],
    particles: [],
    tracers: [],
    floaters: [], // short-lived world-space labels ("+$250", "STOLEN")
    heat: 0, // wanted heat 0..5; stars are its ceiling
    stars: 0,
    seenTimer: 0, // seconds since a police eye last held the player
    bustMeter: 0, // 0..1, fills while the law has the player cornered
    missionIndex: 0, // next story mission to offer
    missionsDone: 0,
    mission: null, // the live mission run, built by missions.js
    dialog: null, // {speaker, lines, index} while someone is talking
    toast: null, // {text, sub, until} centre-screen announcement
    shopNear: null, // a POI the player can use with E right now
    stats: { earned: 0, crimes: 0, shotsFired: 0, carsStolen: 0, distance: 0 },
    camera: { x: 0, y: 0 },
    muted: false,
  };
  return state;
}

/** Was this act seen? Any living witness (pedestrian or officer) or police car close by. */
export function witnessed(state, x, y) {
  for (const ped of state.peds) {
    if (!ped.dead && distance(x, y, ped.x, ped.y) < WANTED.witnessRadius) return true;
  }
  for (const car of state.cars) {
    if (car.driver === 'police' && distance(x, y, car.x, car.y) < WANTED.witnessRadius + 60) return true;
  }
  return false;
}

/**
 * Record a crime: heat rises in full when witnessed, by a third when nobody saw.
 * Scripted mission beats pass `always` — the story needs the heat it promises.
 */
export function addCrime(state, amount, x, y, always) {
  const seen = always || witnessed(state, x, y);
  state.heat = Math.min(WANTED.max, state.heat + amount * (seen ? 1 : 0.35));
  state.stats.crimes += 1;
  if (seen) state.seenTimer = 0;
  return seen;
}

/** A short label that floats up from a world point and fades. */
export function addFloater(state, x, y, text, color) {
  state.floaters.push({ x, y, text, color: color || '#ffd23f', t: 0, life: 1.4 });
}

/** A centre-screen announcement with an optional second line. */
export function showToast(state, text, sub, seconds) {
  state.toast = { text, sub: sub || '', until: state.time + (seconds || 2.6) };
}

/** Sparks, smoke and shells: one pool of simple fading particles. */
export function burst(state, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const v = speed * (0.3 + state.rng() * 0.7);
    state.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      t: 0, life: life * (0.6 + state.rng() * 0.7), color, size: size * (0.7 + state.rng() * 0.6),
    });
  }
}

/** Advance the cosmetic pools (particles, tracers, floaters). */
export function updateEffects(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    if (p.t >= p.life) state.particles.splice(i, 1);
  }
  for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
    state.tracers[i].t += dt;
    if (state.tracers[i].t >= state.tracers[i].life) state.tracers.splice(i, 1);
  }
  for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
    const f = state.floaters[i];
    f.t += dt;
    f.y -= 26 * dt;
    if (f.t >= f.life) state.floaters.splice(i, 1);
  }
}

/** Persist the run: money, story progress, place and clock. */
export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.player.money,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      clockMinutes: Math.round(state.clockMinutes),
      earned: state.stats.earned,
    }));
  } catch {
    // Storage can be off (private windows): the run then lasts this visit only.
  }
}

/** The saved run, or null when there is none worth continuing. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Forget the saved run (New Game). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** Apply a loaded save to a fresh world. */
export function applySave(state, data) {
  state.player.money = data.money;
  state.player.x = data.x;
  state.player.y = data.y;
  state.missionIndex = data.missionIndex;
  state.missionsDone = data.missionsDone || 0;
  state.clockMinutes = data.clockMinutes || CLOCK.startMinutes;
  state.stats.earned = data.earned || 0;
}
