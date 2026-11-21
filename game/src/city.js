// The city of Palm Bay: a seeded grid of roads and named blocks in seven districts,
// a promenade, a beach and the bay. Everything the other systems need to know about
// the ground lives here: where the roads run, which rectangles are solid buildings,
// which district a point is in, and where the hospital, the police station, the
// shops and Marisol's café stand.
import { CITY } from './config.js';

const DISTRICTS = [
  { name: 'The Hills', cols: [0, 3], rows: [0, 1], style: 'houses' },
  { name: 'Old Town', cols: [4, 6], rows: [0, 1], style: 'oldtown' },
  { name: 'Portside', cols: [7, 9], rows: [0, 2], style: 'warehouse' },
  { name: 'Marina District', cols: [0, 3], rows: [2, 4], style: 'shops' },
  { name: 'Downtown Serena', cols: [4, 6], rows: [2, 4], style: 'towers' },
  { name: 'East Yards', cols: [7, 9], rows: [3, 4], style: 'warehouse' },
  { name: 'Playa Serena', cols: [0, 9], rows: [5, 6], style: 'hotels' },
];

const NAMES = {
  houses: ['Casa Mirlo', 'Villa Palmera', 'Casa Trini', 'Villa Solana', 'Casa Buena', 'Villa Coral'],
  oldtown: ['Hotel Colonial', 'Casa de Correos', 'Teatro Alba', 'Mercado Viejo', 'Casa Azul', 'Posada Luna'],
  warehouse: ['Almacén 9', 'Frigorífico Sur', 'Depósito Mar', 'Taller Hermanos', 'Bodega Norte', 'Muelles SA'],
  shops: ['Café Sol', 'Farmacia Brisa', 'Tienda Ola', 'Librería Faro', 'Bar El Ancla', 'Joyas Marina'],
  towers: ['Torre Serena', 'Banco del Litoral', 'Edificio Prisma', 'Torre Vela', 'Oficinas Cabo', 'Hotel Mirador'],
  hotels: ['Hotel Brisa', 'Palmas Resort', 'Hotel Delfín', 'Suites Arena', 'Hotel Faro', 'Playa Grande'],
};

const ROOFS = {
  houses: ['#e8d8b8', '#dfc9a0', '#e5cfa5', '#dcc7ae'],
  oldtown: ['#c96f4a', '#b85c48', '#cf7a52', '#a9503f'],
  warehouse: ['#8d9299', '#7d838a', '#969ca3', '#86898d'],
  shops: ['#f0e0bd', '#e9d3ac', '#f2e3c2', '#e6cf9f'],
  towers: ['#9fb6c4', '#8fa9bc', '#a8bfca', '#93a8b8'],
  hotels: ['#f4e6c4', '#eedcae', '#f7ecd0', '#ecd9b0'],
};

const WALLS = {
  houses: ['#f2e6cc', '#eeddc0', '#f5ecd6', '#ead9b8'],
  oldtown: ['#e0a37c', '#d89468', '#e5ab84', '#d18a5f'],
  warehouse: ['#a9a49a', '#9b968c', '#b3aea2', '#a09a8e'],
  shops: ['#f7ead0', '#f3e3c4', '#f9efdb', '#f0dfba'],
  towers: ['#c3d3dc', '#b4c6d2', '#ccd9df', '#bccdd8'],
  hotels: ['#faf0d4', '#f6e8c6', '#fdf4dc', '#f3e5c0'],
};

function districtFor(col, row) {
  for (const d of DISTRICTS) {
    if (col >= d.cols[0] && col <= d.cols[1] && row >= d.rows[0] && row <= d.rows[1]) return d;
  }
  return DISTRICTS[4];
}

/** One building inside a block, placed on the block's building line. */
function makeBuilding(rng, x, y, w, h, style, name) {
  const heights = { houses: [10, 17], oldtown: [22, 42], warehouse: [13, 20], shops: [18, 34], towers: [48, 96], hotels: [32, 58] };
  const [lo, hi] = heights[style];
  return {
    x, y, w, h,
    height: rng.range(lo, hi),
    roof: rng.pick(ROOFS[style]),
    wall: rng.pick(WALLS[style]),
    name,
    style,
  };
}

/** Fill one block with buildings (or lawns and palms, for a park block). */
function fillBlock(city, rng, col, row) {
  const { block, buildingInset } = CITY;
  const x0 = city.vRoads[col] + CITY.road / 2;
  const y0 = city.hRoads[row] + CITY.road / 2;
  const district = districtFor(col, row);
  const inner = block - buildingInset * 2;
  const bx = x0 + buildingInset;
  const by = y0 + buildingInset;
  const park = (col * 7 + row * 13) % 11 === 4; // a few blocks stay green
  const blockInfo = { x: x0, y: y0, size: block, district: district.name, park };
  city.blocks.push(blockInfo);
  if (park) {
    for (let i = 0; i < 7; i += 1) {
      city.palms.push({ x: x0 + rng.range(30, block - 30), y: y0 + rng.range(30, block - 30), s: rng.range(0.8, 1.25) });
    }
    return;
  }
  const names = NAMES[district.style];
  const nameAt = (i) => names[(col * 3 + row * 5 + i) % names.length];
  if (district.style === 'towers' || district.style === 'warehouse') {
    if (rng.chance(0.45)) {
      city.buildings.push(makeBuilding(rng, bx, by, inner, inner, district.style, nameAt(0)));
    } else {
      const gap = 14;
      const w = (inner - gap) / 2;
      city.buildings.push(makeBuilding(rng, bx, by, w, inner, district.style, nameAt(0)));
      city.buildings.push(makeBuilding(rng, bx + w + gap, by, w, inner, district.style, nameAt(1)));
    }
  } else if (district.style === 'houses') {
    const gap = 12;
    const w = (inner - gap) / 2;
    const h = (inner - gap) / 2;
    for (let i = 0; i < 4; i += 1) {
      city.buildings.push(makeBuilding(rng, bx + (i % 2) * (w + gap), by + Math.floor(i / 2) * (h + gap), w, h, district.style, nameAt(i)));
    }
  } else {
    const gap = 12;
    const w = (inner - gap) / 2;
    const h = (inner - gap) / 2;
    for (let i = 0; i < 4; i += 1) {
      if (rng.chance(0.18)) continue; // a courtyard or a small plaza
      city.buildings.push(makeBuilding(rng, bx + (i % 2) * (w + gap), by + Math.floor(i / 2) * (h + gap), w, h, district.style, nameAt(i)));
    }
  }
  // Palms lean over the sidewalks of the sunnier districts.
  if (district.style !== 'warehouse' && rng.chance(0.8)) {
    city.palms.push({ x: x0 + 14, y: y0 + 14, s: rng.range(0.85, 1.15) });
    city.palms.push({ x: x0 + block - 14, y: y0 + block - 14, s: rng.range(0.85, 1.15) });
  }
}

/** A point of interest pinned to the sidewalk corner of one block. */
function addPoi(city, type, name, col, row, corner) {
  const x0 = city.vRoads[col] + CITY.road / 2;
  const y0 = city.hRoads[row] + CITY.road / 2;
  const cx = corner % 2 === 0 ? x0 + 18 : x0 + CITY.block - 18;
  const cy = corner < 2 ? y0 + 18 : y0 + CITY.block - 18;
  city.pois.push({ type, name, x: cx, y: cy });
  return city.pois[city.pois.length - 1];
}

/** Build the whole city from a seeded stream. Deterministic for a given seed. */
export function buildCity(rng) {
  const pitch = CITY.block + CITY.road;
  const city = {
    vRoads: [],
    hRoads: [],
    intersections: [],
    buildings: [],
    blocks: [],
    palms: [],
    lamps: [],
    pois: [],
    districts: DISTRICTS,
  };
  for (let i = 0; i <= CITY.cols; i += 1) city.vRoads.push(CITY.road / 2 + i * pitch);
  for (let j = 0; j <= CITY.rows; j += 1) city.hRoads.push(CITY.road / 2 + j * pitch);
  for (const x of city.vRoads) for (const y of city.hRoads) city.intersections.push({ x, y });

  city.roadsRight = city.vRoads[city.vRoads.length - 1] + CITY.road / 2;
  city.roadsBottom = city.hRoads[city.hRoads.length - 1] + CITY.road / 2;
  city.promenadeY = city.roadsBottom + CITY.promenade / 2;
  city.sandY = city.roadsBottom + CITY.promenade;
  city.waterY = city.sandY + CITY.sand;
  city.width = city.roadsRight;
  city.height = city.waterY + CITY.water;

  for (let col = 0; col < CITY.cols; col += 1) {
    for (let row = 0; row < CITY.rows; row += 1) fillBlock(city, rng, col, row);
  }
  for (const ix of city.intersections) {
    city.lamps.push({ x: ix.x - CITY.road / 2 + 5, y: ix.y - CITY.road / 2 + 5 });
    city.lamps.push({ x: ix.x + CITY.road / 2 - 5, y: ix.y + CITY.road / 2 - 5 });
  }
  for (let x = 60; x < city.width - 40; x += rng.range(70, 120)) {
    city.palms.push({ x, y: city.sandY + rng.range(16, 44), s: rng.range(0.9, 1.3) });
  }

  addPoi(city, 'cafe', 'Café Sol — Marisol', 1, 3, 0);
  addPoi(city, 'hospital', 'Hospital del Litoral', 2, 5, 1);
  addPoi(city, 'police', 'Comisaría de Palm Bay', 5, 2, 2);
  addPoi(city, 'garage', 'Taller Paz — repairs', 8, 1, 3);
  addPoi(city, 'cafe', 'Bar El Ancla — snacks', 6, 5, 0);
  addPoi(city, 'garage', 'Depósito Mar — repairs', 3, 0, 2);
  return city;
}

/** The district record covering a point (beach and bay included). */
export function districtAt(city, x, y) {
  if (y >= city.waterY) return 'The Bay';
  if (y >= city.sandY) return 'Playa Serena';
  const pitch = CITY.block + CITY.road;
  const col = Math.min(CITY.cols - 1, Math.max(0, Math.floor((x - CITY.road / 2) / pitch)));
  const row = Math.min(CITY.rows - 1, Math.max(0, Math.floor((y - CITY.road / 2) / pitch)));
  return districtFor(col, row).name;
}

/** True when the point lies on a road band or the promenade. */
export function isOnRoad(city, x, y) {
  if (y > city.roadsBottom) return y < city.sandY;
  for (const rx of city.vRoads) if (Math.abs(x - rx) <= CITY.road / 2) return true;
  for (const ry of city.hRoads) if (Math.abs(y - ry) <= CITY.road / 2) return true;
  return false;
}

/** The building a circle touches, or null. Buildings are the city's only solid rectangles. */
export function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

/**
 * Move a circle by (dx, dy), sliding along buildings and stopping at the shore and
 * the world edge. `inWater` lets the player wade a little; cars never float.
 * Returns the distance actually moved, so drivers can tell they are stuck.
 */
export function moveCircle(city, ent, dx, dy, r, inWater) {
  const maxY = inWater ? city.waterY + 46 : city.waterY - 6;
  let moved = 0;
  if (dx !== 0) {
    const nx = Math.max(r, Math.min(city.width - r, ent.x + dx));
    if (!circleHitsBuilding(city, nx, ent.y, r)) { moved += Math.abs(nx - ent.x); ent.x = nx; }
  }
  if (dy !== 0) {
    const ny = Math.max(r, Math.min(maxY, ent.y + dy));
    if (!circleHitsBuilding(city, ent.x, ny, r)) { moved += Math.abs(ny - ent.y); ent.y = ny; }
  }
  return moved;
}

/** A random intersection, optionally within a ring around a point. */
export function randomIntersection(rng, city, cx, cy, minD, maxD) {
  const options = city.intersections.filter((p) => {
    const d = Math.hypot(p.x - cx, p.y - cy);
    return d >= minD && d <= maxD;
  });
  if (options.length === 0) return rng.pick(city.intersections);
  return rng.pick(options);
}

/** The intersection nearest a point. */
export function nearestIntersection(city, x, y) {
  let best = city.intersections[0];
  let bestD = Infinity;
  for (const p of city.intersections) {
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** A point on a sidewalk: just off a random intersection, on a block corner. */
export function randomSidewalkPoint(rng, city) {
  const ix = rng.pick(city.intersections);
  const off = CITY.road / 2 + 9;
  const sx = rng.chance(0.5) ? -off : off;
  const sy = rng.chance(0.5) ? -off : off;
  return { x: Math.max(16, Math.min(city.width - 16, ix.x + sx)), y: Math.max(16, Math.min(city.roadsBottom - 8, ix.y + sy)) };
}
