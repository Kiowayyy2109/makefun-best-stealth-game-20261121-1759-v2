// Nightshade: guard AI. Guards patrol waypoints, grow suspicious when they
// see the player in their vision cone, investigate noises and coin tosses,
// chase when fully alert, then search the last known position before giving
// up and returning to patrol. A guard that touches the player catches them.

import { TILE } from './levels.js';
import { moveCircle, inCone } from './world.js';

export const GUARD_R = 14;
export const CONE_RANGE = 265;
export const CONE_HALF = 0.62; // ~35 degrees each side

export function createGuard(def, spawn) {
  const path = def.path.map(([tx, ty]) => ({
    x: tx * TILE + TILE / 2,
    y: 80 + ty * TILE + TILE / 2,
  }));
  const start = path[0] || spawn;
  return {
    x: start.x,
    y: start.y,
    facing: def.sentry ? 0 : Math.PI / 2,
    path,
    wp: 1 % Math.max(1, path.length),
    speed: def.speed || 55,
    sentry: !!def.sentry,
    scanPhase: Math.random() * Math.PI * 2,
    state: 'patrol', // patrol | investigate | chase | search | return
    suspicion: 0,
    lastSeen: null,
    investigateTarget: null,
    investigateTimer: 0,
    searchTimer: 0,
    pauseTimer: 0,
    lostTimer: 0,
    alertedAt: 0,
  };
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

function moveToward(g, world, tx, ty, speed, dt) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return true;
  const target = Math.atan2(dy, dx);
  g.facing = angleLerp(g.facing, target, dt * 8);
  moveCircle(world, g, (dx / d) * speed * dt, (dy / d) * speed * dt, GUARD_R);
  return false;
}

export function updateGuard(g, world, player, dt, game, audio) {
  const sees = inCone(world, g.x, g.y, g.facing, CONE_RANGE, CONE_HALF, player.x, player.y);
  const factor = game.playerFactor;

  if (sees) {
    const dist = Math.hypot(player.x - g.x, player.y - g.y);
    const distF = 1 - (dist / CONE_RANGE) * 0.62;
    const prev = g.suspicion;
    g.suspicion = Math.min(100, g.suspicion + dt * 58 * distF * factor);
    g.lastSeen = { x: player.x, y: player.y };
    g.lostTimer = 0;
    if (prev < 100 && g.suspicion >= 100 && g.state !== 'chase') {
      game.onSpotted(g);
    }
    if (g.suspicion >= 100) {
      g.state = 'chase';
    } else if (g.suspicion >= 30 && g.state === 'patrol') {
      g.state = 'investigate';
      g.investigateTarget = { x: player.x, y: player.y };
      g.investigateTimer = 3;
    }
  } else {
    g.suspicion = Math.max(0, g.suspicion - dt * (g.state === 'chase' ? 6 : 20));
    if (g.state === 'chase') {
      g.lostTimer += dt;
      if (g.lostTimer > 4) {
        g.state = 'search';
        g.searchTimer = 6;
      }
    }
  }

  // Hearing: running footsteps and the ringing coin pull a patrolling guard.
  if (g.state === 'patrol' || g.state === 'return') {
    if (player.noise > 0) {
      const d = Math.hypot(player.x - g.x, player.y - g.y);
      if (d < player.noise + 30) {
        g.state = 'investigate';
        g.investigateTarget = { x: player.x, y: player.y };
        g.investigateTimer = 3.5;
        g.suspicion = Math.max(g.suspicion, 45);
      }
    }
    if (player.coin) {
      const d = Math.hypot(player.coin.x - g.x, player.coin.y - g.y);
      if (d < 240) {
        g.state = 'investigate';
        g.investigateTarget = { x: player.coin.x, y: player.coin.y };
        g.investigateTimer = 5;
        g.suspicion = Math.max(g.suspicion, 35);
      }
    }
  }

  switch (g.state) {
    case 'patrol': {
      if (g.sentry) {
        g.scanPhase += dt * 0.7;
        g.facing = Math.sin(g.scanPhase) * 1.9;
        break;
      }
      if (g.pauseTimer > 0) {
        g.pauseTimer -= dt;
        break;
      }
      const target = g.path[g.wp];
      if (target && moveToward(g, world, target.x, target.y, g.speed, dt)) {
        g.wp = (g.wp + 1) % g.path.length;
        g.pauseTimer = 0.9;
      }
      break;
    }
    case 'investigate': {
      const t = g.investigateTarget;
      if (!t) { g.state = 'return'; break; }
      if (moveToward(g, world, t.x, t.y, g.speed * 1.35, dt)) {
        g.investigateTimer -= dt;
        g.facing += dt * 1.4; // look around while checking the spot
        if (g.investigateTimer <= 0) {
          g.state = 'return';
          g.suspicion = Math.max(0, g.suspicion - 15);
        }
      }
      break;
    }
    case 'chase': {
      const t = g.lastSeen || { x: player.x, y: player.y };
      // Chase the player's live position while visible, else the last seen spot.
      const dest = sees ? { x: player.x, y: player.y } : t;
      moveToward(g, world, dest.x, dest.y, g.speed * 1.85, dt);
      const d = Math.hypot(player.x - g.x, player.y - g.y);
      if (d < 30) game.onCaught(g);
      break;
    }
    case 'search': {
      g.searchTimer -= dt;
      if (g.searchTimer <= 0) {
        g.state = 'return';
        break;
      }
      const t = g.lastSeen || { x: g.x, y: g.y };
      const wob = Math.sin(game.time * 1.3 + g.x) * 60;
      moveToward(g, world, t.x + wob, t.y, g.speed * 1.1, dt);
      break;
    }
    case 'return': {
      const target = g.path[g.wp] || g.path[0];
      if (target && moveToward(g, world, target.x, target.y, g.speed * 1.2, dt)) {
        g.state = 'patrol';
        g.suspicion = 0;
      }
      break;
    }
  }
}

export function guardLabel(g) {
  if (g.suspicion >= 100 || g.state === 'chase') return '!';
  if (g.suspicion >= 30) return '?';
  return '';
}
