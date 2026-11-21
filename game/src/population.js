// Filling the bay with life: the moving traffic, the parked cars along the kerbs
// and the pedestrians on the sidewalks, all spawned once when a world is born —
// by the game loop for a real run, and by shots.js for the staged scenes.
import { PEDS, TRAFFIC } from './config.js';
import { spawnParked, spawnTraffic } from './vehicles.js';
import { spawnWalkers } from './peds.js';

export function spawnPopulation(state) {
  state.trafficFlow = 1; // traffic pace multiplier; missions may calm it later
  spawnTraffic(state, TRAFFIC.cars);
  spawnParked(state, TRAFFIC.parked);
  spawnWalkers(state, PEDS.walkers);
}
