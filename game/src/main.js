// Boot and the one loop for Palm Bay Heat. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between screens — title, play, paused, busted, wasted, complete — and
// this file owns the moves: starting and continuing runs, doors and shops and
// fixers, the camera, the engine and siren mix, and what a bust or a hospital
// visit costs.
//
// ?seed=N fixes the city. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import { CLOCK, PLAYER, SHOPS, STEP, VIEW } from './config.js';
import { createAudio } from './audio.js';
import { playerShoot, updateCombat } from './combat.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { buildMissions, failMission, nextGiver, startMission, updateMission } from './missions.js';
import { spawnPopulation } from './population.js';
import { updatePolice, updateWanted } from './police.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { updateTraffic, updatePlayerCar, collideCars, carRadius } from './vehicles.js';
import { updateWalkers } from './peds.js';
import { moveCircle } from './city.js';
import {
  SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
  addCrime, applySave, clearSave, createWorld, loadSave, saveGame, showToast, updateEffects,
} from './world.js';
import { clamp, distance } from './random.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) {
  if (status) status.textContent = message;
}

function runShot(name) {
  const state = stageShot(name, seed);
  let painted = 0;
  function paint() {
    renderer.draw(state);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** The nearest car the player could take: close, slow, and not the law's. */
function takeableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 52;
  for (const car of state.cars) {
    if (car.hp <= 0 || Math.abs(car.speed) > 24) continue;
    if (car.driver === 'police' || car.driver === 'roadblock') continue;
    const d = distance(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(state, car) {
  const p = state.player;
  if (!car.stolen && car.driver !== 'player') {
    car.stolen = true;
    state.stats.carsStolen += 1;
    addCrime(state, 1.0, car.x, car.y, false);
    showToast(state, 'Car taken', 'Wheels up. Try to look innocent.', 1.6);
  }
  car.driver = 'player';
  p.car = car;
  audio.door();
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  p.car = null;
  // Step out on the left side, onto the street.
  p.x = car.x + Math.cos(car.angle - Math.PI / 2) * (carRadius(car) + 14);
  p.y = car.y + Math.sin(car.angle - Math.PI / 2) * (carRadius(car) + 14);
  audio.door();
}

function respawnAt(state, poiType, hp) {
  const poi = state.city.pois.find((p) => p.type === poiType);
  state.player.x = poi.x + 20;
  state.player.y = poi.y + 24;
  state.player.hp = hp;
  state.player.car = null;
  state.heat = 0;
  state.stars = 0;
  state.bustMeter = 0;
  state.pendingEnd = null;
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    if (state.cars[i].driver === 'police' || state.cars[i].driver === 'roadblock') state.cars.splice(i, 1);
  }
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    if (state.peds[i].role === 'officer') state.peds.splice(i, 1);
  }
}

function runGame() {
  const input = createInput(canvas);
  let state = createWorld(seed);
  spawnPopulation(state);
  state.hasSave = !!loadSave();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let continueWanted = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC') continueWanted = true;
    audio.unlock();
  });
  canvas.addEventListener('mousedown', () => audio.unlock());

  function freshWorld(withSave) {
    state = createWorld(seed);
    spawnPopulation(state);
    if (withSave) {
      const data = loadSave();
      if (data) applySave(state, data);
    }
    state.hasSave = !!loadSave();
    state.screen = SCREEN_PLAY;
    announce('Playing Palm Bay Heat.');
  }

  function handleTitleActions(actions) {
    if (continueWanted && state.hasSave) {
      continueWanted = false;
      freshWorld(true);
      return;
    }
    continueWanted = false;
    if (actions & ACTION_CONFIRM) {
      clearSave();
      freshWorld(false);
    }
  }

  function interact() {
    const p = state.player;
    if (state.dialog) {
      state.dialog.index += 1;
      if (state.dialog.index >= state.dialog.lines.length) state.dialog = null;
      return;
    }
    if (p.car) {
      // Repair at a garage, or step out.
      const garage = state.city.pois.find((poi) => poi.type === 'garage' && distance(p.car.x, p.car.y, poi.x, poi.y) < 84);
      if (garage && p.car.hp < p.car.maxHp && p.money >= SHOPS.repairCost) {
        p.money -= SHOPS.repairCost;
        p.car.hp = p.car.maxHp;
        audio.cash();
        showToast(state, 'Good as new', `${garage.name} — $${SHOPS.repairCost}`, 1.8);
        return;
      }
      if (Math.abs(p.car.speed) < 30) exitCar(state);
      return;
    }
    // On foot: a fixer with a job?
    const giver = nextGiver(state);
    if (!state.mission && giver && distance(p.x, p.y, giver.x, giver.y) < 48) {
      startMission(state);
      return;
    }
    // A shop counter?
    const shop = state.city.pois.find((poi) => (poi.type === 'hospital' || poi.name.startsWith('Bar El Ancla')) && distance(p.x, p.y, poi.x, poi.y) < 46);
    if (shop && p.hp < PLAYER.maxHp && p.money >= SHOPS.healCost) {
      p.money -= SHOPS.healCost;
      p.hp = Math.min(PLAYER.maxHp, p.hp + SHOPS.healAmount);
      audio.cash();
      showToast(state, 'Patched up', `${shop.name} — $${SHOPS.healCost}`, 1.8);
      return;
    }
    const car = takeableCar(state);
    if (car) enterCar(state, car);
  }

  function computePrompt() {
    const p = state.player;
    state.prompt = null;
    if (state.screen !== SCREEN_PLAY || state.dialog) return;
    if (p.car) {
      const garage = state.city.pois.find((poi) => poi.type === 'garage' && distance(p.car.x, p.car.y, poi.x, poi.y) < 84);
      if (garage && p.car.hp < p.car.maxHp) state.prompt = `E — Repair at ${garage.name} ($${SHOPS.repairCost})`;
      else if (Math.abs(p.car.speed) < 30) state.prompt = 'E — Step out';
      return;
    }
    const giver = nextGiver(state);
    if (!state.mission && giver && distance(p.x, p.y, giver.x, giver.y) < 48) {
      const def = buildMissions(state.city)[state.missionIndex];
      state.prompt = `E — Talk: “${def ? def.title : 'a job'}”`;
      return;
    }
    const shop = state.city.pois.find((poi) => (poi.type === 'hospital' || poi.name.startsWith('Bar El Ancla')) && distance(p.x, p.y, poi.x, poi.y) < 46);
    if (shop && p.hp < PLAYER.maxHp) {
      state.prompt = `E — Patch up at ${shop.name} ($${SHOPS.healCost})`;
      return;
    }
    const car = takeableCar(state);
    if (car) state.prompt = `E — Take the ${car.kind}`;
  }

  function stepPlay(dt) {
    const p = state.player;
    state.time += dt;
    state.clockMinutes = (state.clockMinutes + (dt / CLOCK.secondsPerHour) * 60) % (24 * 60);

    const actions = input.takeActions();
    if (actions & ACTION_MUTE) state.muted = audio.toggleMute();
    if (actions & ACTION_PAUSE) { state.screen = SCREEN_PAUSED; return; }
    if (actions & ACTION_INTERACT) interact();
    if (state.dialog) {
      // The street keeps breathing while people talk, but nobody shoots.
      for (const car of state.cars) if (car.driver === 'traffic') updateTraffic(state, car, dt);
      updateWalkers(state, dt);
      updateEffects(state, dt);
      computePrompt();
      return;
    }

    // Movement: wheels or feet.
    if (p.car) {
      updatePlayerCar(state, p.car, dt, input);
      p.x = p.car.x;
      p.y = p.car.y;
    } else {
      const ax = input.axisX();
      const ay = input.axisY();
      const speed = input.sprint() ? 268 : 178;
      if (ax !== 0 || ay !== 0) {
        const len = Math.hypot(ax, ay);
        const dx = (ax / len) * speed * dt;
        const dy = (ay / len) * speed * dt;
        moveCircle(state.city, p, dx, dy, PLAYER.radius, true);
        p.angle = Math.atan2(ay, ax);
        state.playerPhase = (state.playerPhase || 0) + dt * 11;
        state.stats.distance += speed * dt * 0.4;
      }
      if (input.firing() && p.shotTimer <= 0) {
        p.angle = Math.atan2(input.mouse.y + state.camera.y - p.y, input.mouse.x + state.camera.x - p.x);
      }
    }

    // Shooting, from the pavement or through a car window.
    if (input.firing() && p.shotTimer <= 0 && !state.dialog) {
      playerShoot(state, input.mouse.x + state.camera.x, input.mouse.y + state.camera.y, audio);
    }

    for (const car of state.cars) if (car.driver === 'traffic') updateTraffic(state, car, dt);
    updateMission(state, dt, audio);
    updateWanted(state, dt);
    updatePolice(state, dt);
    updateWalkers(state, dt);
    collideCars(state, dt);
    updateCombat(state, dt);
    updateEffects(state, dt);
    computePrompt();

    // Traffic noise: a honk now and then from a car the player is blocking.
    for (const car of state.cars) {
      if (car.wantHonk) {
        car.wantHonk = false;
        if (distance(car.x, car.y, p.x, p.y) < 420) audio.horn();
      }
    }

    if (state.pendingEnd === 'busted') {
      const fine = Math.min(p.money, 40 + state.stars * 45 + Math.round(p.money * 0.1));
      p.money -= fine;
      state.bustFine = fine;
      if (state.mission) failMission(state, 'The law closed the job.');
      state.screen = SCREEN_BUSTED;
      announce(`Busted. Fine $${fine}.`);
    } else if (state.pendingEnd === 'wasted') {
      const bill = Math.min(p.money, 150);
      p.money -= bill;
      state.wastedBill = bill;
      if (state.mission) failMission(state, 'The job died with Rio. It can be run again.');
      state.screen = SCREEN_WASTED;
      announce(`Wasted. Hospital bill $${bill}.`);
    }
    if (state.missionsDone >= 7 && !state.storyShown) {
      state.storyShown = true;
      state.screen = SCREEN_COMPLETE;
      saveGame(state);
    }
    saveTimer += dt;
    if (saveTimer > 20) {
      saveTimer = 0;
      if (!state.mission) saveGame(state);
    }
  }

  function step(dt) {
    const screen = state.screen;
    if (screen === SCREEN_TITLE) {
      // The bay lives behind the title: traffic rolls, people stroll, dusk falls.
      state.time += dt;
      state.clockMinutes = 17 * 60 + 30 + Math.sin(state.time * 0.05) * 22;
      for (const car of state.cars) if (car.driver === 'traffic') updateTraffic(state, car, dt);
      updateWalkers(state, dt);
      updateEffects(state, dt);
      const pan = (Math.sin(state.time * 0.045) * 0.5 + 0.5) * (state.city.width - VIEW.width);
      state.camera.x = pan;
      state.camera.y = state.city.height - VIEW.height - 260;
      handleTitleActions(input.takeActions());
      return;
    }
    if (screen === SCREEN_PLAY) {
      stepPlay(dt);
    } else if (screen === SCREEN_PAUSED) {
      const actions = input.takeActions();
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) state.screen = SCREEN_PLAY;
    } else if (screen === SCREEN_BUSTED) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        respawnAt(state, 'police', 70);
        state.screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_WASTED) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        respawnAt(state, 'hospital', 100);
        state.screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_COMPLETE) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) state.screen = SCREEN_PLAY;
    }
    // Camera: follow the player (or the car), with a lookahead at speed.
    const p = state.player;
    const focusX = p.car ? p.car.x + Math.cos(p.car.angle) * p.car.speed * 0.34 : p.x;
    const focusY = p.car ? p.car.y + Math.sin(p.car.angle) * p.car.speed * 0.34 : p.y;
    const tx = clamp(focusX - VIEW.width / 2, 0, Math.max(0, state.city.width - VIEW.width));
    const ty = clamp(focusY - VIEW.height / 2, 0, Math.max(0, state.city.height - VIEW.height));
    const k = screen === SCREEN_TITLE ? 1 : Math.min(1, dt * 7);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
    if (state.crashShake > 0) {
      state.camera.x += (Math.random() - 0.5) * state.crashShake;
      state.camera.y += (Math.random() - 0.5) * state.crashShake;
      state.crashShake = Math.max(0, state.crashShake - dt * 16);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      step(STEP);
      accumulator -= STEP;
    }
    // Sound follows the frame: engine note and the nearest siren.
    const p = state.player;
    if (state.screen === SCREEN_PLAY && p.car) {
      audio.engine(true, Math.abs(p.car.speed) / 430);
    } else {
      audio.engine(false, 0);
    }
    let siren = 0;
    if (state.stars > 0) {
      let nearest = Infinity;
      for (const car of state.cars) {
        if (car.driver === 'police' || car.driver === 'roadblock') {
          nearest = Math.min(nearest, distance(car.x, car.y, p.x, p.y));
        }
      }
      if (nearest < 700) siren = 1 - nearest / 700;
    }
    audio.siren(siren);
    renderer.draw(state);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) state.screen = SCREEN_PAUSED;
  });

  announce('Palm Bay Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
