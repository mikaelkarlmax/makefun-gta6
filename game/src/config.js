// Palm Bay Heat — every tuning number and colour in one place.
// The view is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size. World units are pixels.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** City layout: a grid of blocks and roads, then a promenade, sand and the bay. */
export const CITY = {
  cols: 10, // city blocks across
  rows: 7, // city blocks down
  block: 240, // block edge, including its sidewalks
  road: 56, // road width
  sidewalk: 12, // pavement ring inside each block
  buildingInset: 30, // building line inside the sidewalk
  promenade: 34, // walking strip between the last road and the sand
  sand: 130, // beach depth
  water: 300, // bay depth below the sand
};

export const PLAYER = {
  radius: 11,
  walkSpeed: 178,
  sprintSpeed: 268,
  maxHp: 100,
  punchRange: 46,
  punchDamage: 34,
  shotRange: 400,
  shotDamage: 26,
  shotCooldown: 0.16,
  startMoney: 120,
};

/** Car handling, per kind. Speeds are px/s, turn is rad/s at full lock. */
export const CAR_KINDS = {
  compact: { w: 40, h: 20, maxSpeed: 330, reverse: 120, accel: 300, turn: 2.6, hp: 120 },
  sedan: { w: 44, h: 21, maxSpeed: 360, reverse: 130, accel: 320, turn: 2.5, hp: 140 },
  taxi: { w: 44, h: 21, maxSpeed: 355, reverse: 130, accel: 315, turn: 2.5, hp: 140 },
  sports: { w: 42, h: 20, maxSpeed: 470, reverse: 150, accel: 430, turn: 2.9, hp: 110 },
  van: { w: 48, h: 23, maxSpeed: 300, reverse: 110, accel: 260, turn: 2.2, hp: 190 },
  police: { w: 44, h: 21, maxSpeed: 430, reverse: 140, accel: 400, turn: 2.8, hp: 200 },
};

export const TRAFFIC = {
  cars: 22, // civilian cars moving at once
  parked: 26, // parked cars waiting to be borrowed
  speed: 150, // cruise speed of traffic
  brakeDistance: 58,
};

export const PEDS = { walkers: 42, walkSpeed: 62, fleeSpeed: 185, hp: 30 };

export const POLICE = {
  officerHp: 60,
  officerSpeed: 196,
  shotDamage: 7, // per landed shot tick on the player
  shotInterval: 0.9,
  shotRange: 300,
  bustRadius: 40,
  bustSeconds: 1.7, // standing in reach of the law this long ends the chase
  spawnDistance: 560,
  despawnDistance: 980,
};

/** Wanted heat: crimes add heat, hiding lets it cool. Stars are ceil(heat). */
export const WANTED = {
  max: 5,
  witnessRadius: 280,
  seenRadius: 460, // police within this (and looking) count as seeing the player
  coolDelay: 5, // seconds unseen before heat starts to cool
  coolRate: 0.055, // heat per second while hidden
  crimes: {
    stealCar: 1.0,
    hitPed: 1.6,
    hitCar: 0.35,
    gunshot: 0.7,
    killPed: 2.2,
    hurtOfficer: 1.4,
    killOfficer: 2.6,
  },
};

/** One game hour lasts this many real seconds; the day starts at 10:00. */
export const CLOCK = { secondsPerHour: 20, startMinutes: 10 * 60 };

export const SHOPS = {
  healCost: 40,
  healAmount: 60,
  repairCost: 60,
};

export const PALETTE = {
  water: '#1d6f8e',
  waterDeep: '#175d7a',
  sand: '#ecd29a',
  promenade: '#cdbfa3',
  grass: '#57a05a',
  park: '#4c9455',
  sidewalk: '#b9b3a4',
  road: '#3c4048',
  roadLine: '#e8e4d2',
  crosswalk: '#d8d4c4',
  player: '#ffd23f',
  police: '#2b4acb',
  policeLight: '#ff4757',
  mission: '#ffc61a',
  danger: '#ff4757',
  cash: '#2ed573',
  text: '#f5f2e8',
  panel: 'rgba(12, 16, 24, 0.78)',
  night: '#0a1030',
  dusk: '#ff9a3c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the run's save is kept between visits (this browser only). */
export const SAVE_KEY = 'palm-bay-heat.save.v1';
