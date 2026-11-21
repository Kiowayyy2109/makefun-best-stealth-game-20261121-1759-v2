// Nightshade: the level grid — parsing, collision, line of sight, lighting queries.
// A level map is parsed once into: solid cells (walls + furniture), floor kind per
// cell (marble / carpet / shadow), lamps, relics, exit, player start, guard and
// camera spawns, and laser runs. All positions are in pixels; tile(x) maps a
// pixel coordinate to its cell.

import { TILE, COLS, ROWS, HUD_H } from './levels.js';

export const SOLID = new Set(['#', 'C', 'D', 'B', 'S']);
export const FLOOR_KIND = { '.': 'marble', ',': 'carpet', '~': 'shadow' };

export function parseLevel(def) {
  const solid = new Set();
  const floor = [];
  const lamps = [];
  const relics = [];
  const lasers = [];
  const guardSpawns = [];
  const cameraSpawns = [];
  let player = { x: TILE * 2, y: HUD_H + TILE * 2 };
  let exit = { x: TILE * 30, y: HUD_H + TILE * 14 };
  const key = (x, y) => y * COLS + x;

  def.map.forEach((row, y) => {
    for (let x = 0; x < COLS; x++) {
      const ch = row[x];
      const cx = x * TILE + TILE / 2;
      const cy = HUD_H + y * TILE + TILE / 2;
      if (SOLID.has(ch)) solid.add(key(x, y));
      floor.push({ x, y, kind: FLOOR_KIND[ch] || 'marble' });
      if (ch === 'L') lamps.push({ x: cx, y: cy });
      if (ch === 'R') relics.push({ x: cx, y: cy, taken: false, bob: Math.random() * 6 });
      if (ch === 'T') player = { x: cx, y: cy };
      if (ch === 'E') exit = { x: cx, y: cy };
      if (ch === 'G') guardSpawns.push({ x: cx, y: cy });
      if (ch === 'V') cameraSpawns.push({ x: cx, y: cy });
      if (ch === '=') lasers.push({ x, y, cx, cy });
    }
  });

  // Group laser cells into horizontal runs; each run blinks on its own cycle.
  const runs = [];
  const byRow = new Map();
  for (const c of lasers) {
    if (!byRow.has(c.y)) byRow.set(c.y, []);
    byRow.get(c.y).push(c);
  }
  let runIndex = 0;
  for (const [y, cells] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    cells.sort((a, b) => a.x - b.x);
    let start = cells[0];
    let prev = cells[0];
    const flush = (last) => {
      runs.push({ y, x0: start.x, x1: last.x, phase: (runIndex * 0.9) % 3.2, index: runIndex });
      runIndex++;
    };
    for (let i = 1; i < cells.length; i++) {
      if (cells[i].x === prev.x + 1) { prev = cells[i]; continue; }
      flush(prev);
      start = cells[i]; prev = cells[i];
    }
    flush(prev);
  }

  return { def, solid, floor, lamps, relics, lasers, runs, guardSpawns, cameraSpawns, player, exit };
}

export function cellAt(world, px, py) {
  const x = Math.floor(px / TILE);
  const y = Math.floor((py - HUD_H) / TILE);
  return { x, y };
}

export function isSolid(world, px, py) {
  const { x, y } = cellAt(world, px, py);
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return world.solid.has(y * COLS + x);
}

// Circle vs solid-cell collision: test the four corners of the circle's box.
export function collides(world, px, py, r) {
  return (
    isSolid(world, px - r, py - r) || isSolid(world, px + r, py - r) ||
    isSolid(world, px - r, py + r) || isSolid(world, px + r, py + r) ||
    isSolid(world, px, py - r) || isSolid(world, px, py + r) ||
    isSolid(world, px - r, py) || isSolid(world, px + r, py)
  );
}

// Move with axis separation so the player slides along walls.
export function moveCircle(world, pos, dx, dy, r) {
  if (dx !== 0 && !collides(world, pos.x + dx, pos.y, r)) pos.x += dx;
  if (dy !== 0 && !collides(world, pos.x, pos.y + dy, r)) pos.y += dy;
}

// Bresenham-style line of sight between two points (walls and furniture block).
export function hasLineOfSight(world, ax, ay, bx, by) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolid(world, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

export function floorKindAt(world, px, py) {
  const { x, y } = cellAt(world, px, py);
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return 'marble';
  const row = world.def.map[y];
  const ch = row ? row[x] : '.';
  return FLOOR_KIND[ch] || 'marble';
}

export function inLampLight(world, px, py) {
  for (const lamp of world.lamps) {
    if (Math.hypot(px - lamp.x, py - lamp.y) < 120) return true;
  }
  return false;
}

// Is this point inside a vision cone (range, half-angle, facing) with line of sight?
export function inCone(world, ox, oy, facing, range, halfAngle, px, py) {
  const dx = px - ox;
  const dy = py - oy;
  const d = Math.hypot(dx, dy);
  if (d > range) return false;
  if (d < 12) return true;
  let ang = Math.atan2(dy, dx) - facing;
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  if (Math.abs(ang) > halfAngle) return false;
  return hasLineOfSight(world, ox, oy, px, py);
}
