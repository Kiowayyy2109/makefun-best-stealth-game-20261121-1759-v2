// Nightshade: the player — Nightshade the thief. Movement speeds, sneak/run
// stances, the coin toss, relic pickup, noise, and the caught check.

import { TILE, HUD_H } from './levels.js';
import { moveCircle, floorKindAt, inLampLight, cellAt } from './world.js';

export const PLAYER_R = 13;

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    facing: -Math.PI / 2, // facing up the gallery
    sneaking: false,
    running: false,
    moving: false,
    stepTimer: 0,
    noise: 0, // current noise radius, decays each frame
    noiseFlash: 0, // timer for drawing the noise ring
    coins: 3,
    coin: null, // {x, y, t} a coin in flight / lying and ringing
    relics: 0,
    bobPhase: 0,
  };
}

export function updatePlayer(p, input, world, game, dt, audio) {
  const mv = input.moveVector();
  p.moving = mv.x !== 0 || mv.y !== 0;
  p.sneaking = input.any('ShiftLeft', 'ShiftRight');
  // Sprint is Space (loud, fast); Shift is sneak (slow, quiet).
  p.running = !p.sneaking && input.any('Space');
  if (p.moving) {
    p.facing = Math.atan2(mv.y, mv.x);
    const speed = p.sneaking ? 72 : p.running ? 235 : 150;
    moveCircle(world, p, mv.x * speed * dt, mv.y * speed * dt, PLAYER_R);
    p.stepTimer -= dt;
    const stepEvery = p.sneaking ? 0.55 : p.running ? 0.26 : 0.38;
    if (p.stepTimer <= 0) {
      p.stepTimer = stepEvery;
      audio.step(p.sneaking);
    }
    if (p.running) {
      p.noise = 150;
      p.noiseFlash = 0.35;
    }
  }
  p.noise = Math.max(0, p.noise - dt * 260);
  p.noiseFlash = Math.max(0, p.noiseFlash - dt);
  p.bobPhase += dt * (p.moving ? 9 : 3);

  // Coin toss: Q throws a coin ahead of the player; it rings and draws guards.
  if (p.coin) {
    p.coin.t -= dt;
    if (p.coin.t <= 0) p.coin = null;
  }

  // Relic pickup: walk onto a relic, or press E nearby.
  const pressed = game.pressed;
  let picked = null;
  for (const relic of world.relics) {
    if (relic.taken) continue;
    const d = Math.hypot(p.x - relic.x, p.y - relic.y);
    const near = d < 46;
    if (d < 26 || (near && pressed.includes('KeyE'))) {
      relic.taken = true;
      p.relics++;
      picked = relic;
      audio.pickup();
      game.onRelic(p.relics);
    }
  }
  return picked;
}

export function throwCoin(p, audio) {
  if (p.coins <= 0 || p.coin) return false;
  p.coins--;
  const dist = 190;
  const tx = p.x + Math.cos(p.facing) * dist;
  const ty = p.y + Math.sin(p.facing) * dist;
  // Clamp the landing point inside the play area.
  p.coin = {
    x: Math.min(1270, Math.max(10, tx)),
    y: Math.min(HUD_H + 630, Math.max(HUD_H + 10, ty)),
    t: 5,
  };
  audio.coin();
  setTimeout(() => audio.clink(), 260);
  return true;
}

// Detection multiplier for the player's current state and lighting.
export function detectionFactor(p, world) {
  let f = 1;
  if (p.sneaking) f *= 0.45;
  if (p.running) f *= 1.5;
  const kind = floorKindAt(world, p.x, p.y);
  if (kind === 'shadow') f *= 0.38;
  else if (kind === 'carpet') f *= 0.8;
  if (inLampLight(world, p.x, p.y)) f *= 1.35;
  return f;
}

export function playerTile(p) {
  return cellAt(null, p.x, p.y);
}
