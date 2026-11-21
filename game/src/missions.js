// The story of Rio's debt: seven jobs for the fixers of Palm Bay, run by a small
// step machine. Steps are data — go somewhere, pick someone up, disable a fleeing
// van, thread checkpoints against the clock, hold a vault yard while the heat
// rises, cool off at a hideout — and this file walks them, pays them and fails
// them. The HUD reads state.mission.target to point the way.
import { createCar, steerCar } from './vehicles.js';
import { createPed } from './peds.js';
import { addCrime, addFloater, saveGame, showToast } from './world.js';
import { distance } from './random.js';

function poi(city, name) {
  return city.pois.find((p) => p.name.startsWith(name));
}

/** The seven jobs, with every place resolved against the built city. */
export function buildMissions(city) {
  const cafe = poi(city, 'Café Sol');
  const garage = poi(city, 'Taller Paz');
  const bar = poi(city, 'Bar El Ancla');
  return [
    {
      title: 'First Errand', giver: 'Marisol', at: cafe, reward: 180,
      intro: [
        'Marisol: Rio. You owe the Cangrejo crew, and owing them is a short road.',
        'Marisol: Run this package to Portside for me. Quietly. Then Tito at Bar El Ancla gets it.',
        'Rio: Quiet is my middle name. (It is not.)',
      ],
      steps: [
        { type: 'goto', x: 2664, y: 352, label: 'Pick up the package in Portside' },
        { type: 'goto', x: bar.x, y: bar.y, label: 'Deliver the package to Tito at Bar El Ancla' },
      ],
    },
    {
      title: 'Pier Pressure', giver: 'Marisol', at: cafe, reward: 260,
      intro: [
        'Marisol: My niece Lucía is stranded at the pier and the last bus is a rumour.',
        'Marisol: Bring her to her aunt\'s house in The Hills. The clock, Rio. Watch it.',
      ],
      steps: [
        { type: 'passenger', x: 1508, y: 2140, label: 'Pick up Lucía at the pier (drive up to her)' },
        { type: 'goto', x: 380, y: 250, label: 'Drop Lucía at The Hills', time: 160 },
      ],
    },
    {
      title: 'Hot Metal', giver: 'Paz', at: garage, reward: 340,
      intro: [
        'Paz: A red coupé sleeps in Portside with the keys in. Collectors pay well for red.',
        'Paz: Bring her to my lift — and Rio, the owner has friends with radios.',
      ],
      steps: [
        { type: 'steal', x: 2424, y: 648, label: 'Steal the red coupé in Portside' },
        { type: 'goto', x: garage.x, y: garage.y, label: 'Bring the coupé to Taller Paz', inStolen: true },
      ],
    },
    {
      title: 'Bay Hunter', giver: 'Tito', at: bar, reward: 420,
      intro: [
        'Tito: A grey van lifted my whole cellar at dawn. It is still rolling the bay.',
        'Tito: Stop it — hard — then tell me where it died. The cellar comes home.',
      ],
      steps: [
        { type: 'chase', x: 648, y: 1776, label: 'Disable Tito\'s stolen van' },
        { type: 'goto', x: 352, y: 1480, label: 'Report back at the Marina marker' },
      ],
    },
    {
      title: 'Cool Off', giver: 'Marisol', at: cafe, reward: 380,
      intro: [
        'Marisol: Everyone is looking for you today. Everyone with a badge, anyway.',
        'Marisol: The old park house in The Hills. Go there, be nobody, let the bay forget.',
      ],
      steps: [
        { type: 'goto', x: 648, y: 352, label: 'Reach the park house in The Hills', heatOnStart: 3.2 },
        { type: 'loseheat', x: 648, y: 352, label: 'Stay near the hideout until the heat cools' },
      ],
    },
    {
      title: 'Serena Sprint', giver: 'Paz', at: garage, reward: 450,
      intro: [
        'Paz: The Sprint, Rio. Six lights across the whole bay, one clock, no excuses.',
        'Paz: Beat it and half the garages in Serena will know your name.',
      ],
      steps: [
        {
          type: 'checkpoints', label: 'Thread the Sprint checkpoints', time: 175,
          points: [
            { x: 56, y: 2072 }, { x: 2960, y: 2072 }, { x: 2960, y: 56 },
            { x: 1508, y: 916 }, { x: 56, y: 56 }, { x: garage.x, y: garage.y },
          ],
        },
      ],
    },
    {
      title: 'The Cangrejo Score', giver: 'Tito', at: bar, reward: 900,
      intro: [
        'Tito: One last job and your debt is ash. The Hotel Mirador keeps the crew\'s money.',
        'Tito: Fetch Bruno and Sana, hold the service yard, then vanish to the park house.',
      ],
      steps: [
        { type: 'goto', x: 944, y: 1480, label: 'Pick up Bruno (wait in the car)' , crew: true },
        { type: 'goto', x: 2072, y: 1184, label: 'Pick up Sana (wait in the car)', crew: true },
        { type: 'hold', x: 1776, y: 1776, seconds: 12, label: 'Hold the Hotel Mirador service yard', heatOnStart: 3.6 },
        { type: 'goto', x: 648, y: 352, label: 'Vanish to the park house in The Hills' },
      ],
    },
  ];
}

/** Where the next job is offered, or null when the story is told. */
export function nextGiver(state) {
  const defs = buildMissions(state.city);
  if (state.missionIndex >= defs.length) return null;
  return defs[state.missionIndex].at;
}

/** Begin the next job: stage its actors, open with the giver's words. */
export function startMission(state) {
  const defs = buildMissions(state.city);
  const def = defs[state.missionIndex];
  if (!def) return;
  const run = {
    def, stepIndex: 0, step: null, target: null, timeLeft: null,
    targetCar: null, passenger: null, crew: 0, holdT: 0, pointIndex: 0,
  };
  state.mission = run;
  state.dialog = { speaker: def.giver, lines: def.intro, index: 0 };
  beginStep(state, run);
}

/** Set up one step's actors, target and clock. */
function beginStep(state, run) {
  const step = run.def.steps[run.stepIndex];
  run.step = step;
  run.timeLeft = step.time || null;
  run.holdT = 0;
  run.pointIndex = 0;
  if (step.heatOnStart) {
    state.heat = Math.max(state.heat, step.heatOnStart);
    state.seenTimer = 0;
  }
  if (step.type === 'passenger') {
    run.passenger = createPed(state.rng, step.x, step.y, 'passenger');
    state.peds.push(run.passenger);
  }
  if (step.type === 'steal') {
    run.targetCar = createCar(state.rng, 'sports', step.x, step.y, Math.PI / 2, 'parked');
    run.targetCar.color = '#d63031';
    state.cars.push(run.targetCar);
  }
  if (step.type === 'chase') {
    run.targetCar = createCar(state.rng, 'van', step.x, step.y, 0, 'chase');
    run.targetCar.color = '#636e72';
    state.cars.push(run.targetCar);
  }
  updateTarget(state, run);
}

/** The point the HUD arrow and the minimap blip should show right now. */
function updateTarget(state, run) {
  const step = run.step;
  if (!step) { run.target = null; return; }
  if (step.type === 'chase' && run.targetCar) {
    run.target = { x: run.targetCar.x, y: run.targetCar.y, label: step.label };
  } else if (step.type === 'checkpoints') {
    const p = step.points[run.pointIndex];
    run.target = { x: p.x, y: p.y, label: `${step.label} (${run.pointIndex + 1}/${step.points.length})` };
  } else {
    run.target = { x: step.x, y: step.y, label: step.label };
  }
}

function playerAt(state, x, y, radius) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  return distance(px, py, x, y) < radius;
}

function completeMission(state, audio) {
  const run = state.mission;
  const pay = run.def.reward;
  state.player.money += pay;
  state.stats.earned += pay;
  state.missionsDone += 1;
  state.missionIndex += 1;
  state.mission = null;
  showToast(state, 'MISSION COMPLETE', `${run.def.title} — $${pay}`, 3.4);
  addFloater(state, state.player.x, state.player.y - 20, `+$${pay}`, '#2ed573');
  audio.jingle();
  audio.cash();
  saveGame(state);
}

/** End the live job without pay — a bust, a hospital bed, a blown clock. */
export function failMission(state, reason) {
  showToast(state, 'MISSION FAILED', reason, 3);
  // Clean up staged actors so a retry starts fair.
  const run = state.mission;
  if (run) {
    if (run.passenger) state.peds.splice(state.peds.indexOf(run.passenger), 1);
    if (run.targetCar && run.targetCar.driver === 'chase') state.cars.splice(state.cars.indexOf(run.targetCar), 1);
  }
  state.mission = null;
}

/** Advance the live job one step; called only while no dialog is open. */
export function updateMission(state, dt, audio) {
  const run = state.mission;
  if (!run || state.dialog) return;
  const step = run.step;
  const player = state.player;

  if (run.timeLeft !== null) {
    run.timeLeft -= dt;
    if (run.timeLeft <= 0) { failMission(state, 'Out of time. The job is off.'); return; }
  }
  updateTarget(state, run);

  const advance = () => {
    run.stepIndex += 1;
    if (run.stepIndex >= run.def.steps.length) completeMission(state, audio);
    else beginStep(state, run);
  };

  switch (step.type) {
    case 'goto': {
      if (step.inStolen && player.car !== run.targetCar) {
        if (playerAt(state, step.x, step.y, 60) && !player.car) showToast(state, 'Wrong wheels', 'Paz wants the red coupé itself.', 1.2);
        break;
      }
      if (step.crew && !player.car) break; // the crew only boards a car
      if (playerAt(state, step.x, step.y, step.crew ? 52 : 46)) {
        if (step.crew) {
          run.crew += 1;
          addFloater(state, step.x, step.y - 16, 'Aboard!', '#7bed9f');
          audio.door();
        }
        advance();
      }
      break;
    }
    case 'passenger': {
      const ped = run.passenger;
      if (ped && player.car && distance(player.car.x, player.car.y, ped.x, ped.y) < 40) {
        state.peds.splice(state.peds.indexOf(ped), 1);
        run.passenger = null;
        audio.door();
        showToast(state, 'Lucía is in', 'The Hills, and mind the clock.', 2);
        advance();
      } else if (ped && !player.car && distance(player.x, player.y, ped.x, ped.y) < 30) {
        showToast(state, 'Lucía waits', 'She needs a car, Rio. Bring one.', 1.4);
      }
      break;
    }
    case 'steal': {
      if (player.car === run.targetCar) {
        addCrime(state, 2.0, player.car.x, player.car.y, true);
        showToast(state, 'The coupé is yours', 'Every radio in Portside just woke up.', 2.4);
        advance();
      }
      break;
    }
    case 'chase': {
      const target = run.targetCar;
      if (!target) { advance(); break; }
      // The van runs: away from the player, fast, and not too bright about walls.
      const away = Math.atan2(target.y - (player.car ? player.car.y : player.y), target.x - (player.car ? player.car.x : player.x));
      const fleeX = target.x + Math.cos(away) * 300;
      const fleeY = target.y + Math.sin(away) * 300;
      steerCar(state, target, dt, fleeX, fleeY, 305, 2.4);
      if (target.hp <= 0) {
        showToast(state, 'The van is stopped', 'Tito will want the good news in person.', 2.4);
        advance();
      }
      break;
    }
    case 'checkpoints': {
      const p = step.points[run.pointIndex];
      if (playerAt(state, p.x, p.y, 64)) {
        run.pointIndex += 1;
        audio.cash();
        if (run.pointIndex >= step.points.length) advance();
        else showToast(state, `Checkpoint ${run.pointIndex}/${step.points.length}`, 'Keep it pinned.', 1.2);
      }
      break;
    }
    case 'hold': {
      if (playerAt(state, step.x, step.y, 74)) {
        run.holdT += dt;
        if (run.holdT >= step.seconds) advance();
      } else {
        run.holdT = Math.max(0, run.holdT - dt * 0.7);
      }
      break;
    }
    case 'loseheat': {
      if (playerAt(state, step.x, step.y, 320) && state.heat < 0.4) advance();
      break;
    }
    default:
      break;
  }
}
