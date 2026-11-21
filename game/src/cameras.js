// Nightshade: security cameras and laser tripwires. Cameras sweep their cone
// back and forth; spotting the player raises the alarm. Lasers blink across
// corridor rows — crossing a live beam trips the alarm.

import { TILE } from './levels.js';
import { inCone } from './world.js';

export const CAM_RANGE = 250;
export const CAM_HALF = 0.55;

export function createCamera(def, spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    base: def.base || 0,
    sweep: def.sweep || 1.0,
    speed: def.speed || 0.5,
    phase: Math.random() * Math.PI * 2,
    facing: def.base || 0,
    suspicion: 0,
  };
}

export function updateCamera(cam, world, player, dt, game) {
  cam.phase += dt * cam.speed;
  cam.facing = cam.base + Math.sin(cam.phase) * cam.sweep;
  const sees = inCone(world, cam.x, cam.y, cam.facing, CAM_RANGE, CAM_HALF, player.x, player.y);
  if (sees) {
    const dist = Math.hypot(player.x - cam.x, player.y - cam.y);
    const distF = 1 - (dist / CAM_RANGE) * 0.5;
    const prev = cam.suspicion;
    cam.suspicion = Math.min(100, cam.suspicion + dt * 75 * distF * game.playerFactor);
    if (prev < 100 && cam.suspicion >= 100) game.onSpotted(cam);
  } else {
    cam.suspicion = Math.max(0, cam.suspicion - dt * 25);
  }
}

// A laser run is ON for 2.0s of every 3.2s cycle, offset by its phase.
export function laserIsOn(run, time) {
  const t = (time + run.phase) % 3.2;
  return t < 2.0;
}

export function playerOnLaser(world, player) {
  const x = Math.floor(player.x / TILE);
  const y = Math.floor((player.y - 80) / TILE);
  for (const run of world.runs) {
    if (run.y === y && x >= run.x0 && x <= run.x1) return run;
  }
  return null;
}
