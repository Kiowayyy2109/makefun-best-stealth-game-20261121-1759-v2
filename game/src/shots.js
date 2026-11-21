// Nightshade: deterministic screenshot staging for ?shot=<name>.
// Each shot loads a level and poses the scene so a single frame sells the
// game — real gameplay state, not a mockup. Guards keep patrolling, so the
// capture script waits a beat, then screenshots the live canvas.

import { TILE, HUD_H } from './levels.js';

function placePlayer(game, tx, ty, facing) {
  game.player.x = tx * TILE + TILE / 2;
  game.player.y = HUD_H + ty * TILE + TILE / 2;
  if (facing !== undefined) game.player.facing = facing;
}

export function applyShot(game, name) {
  if (name === 'start') {
    // Level 1, opening beat: full gallery, cones sweeping, lamps glowing.
    game.loadLevel(0);
    game.state = 'play';
    placePlayer(game, 3, 2, 0);
    game.guards[0].x = 12 * TILE + 20;
    game.guards[0].y = HUD_H + 2 * TILE + 20;
    game.guards[0].facing = Math.PI / 2;
    game.guards[1].x = 18 * TILE + 20;
    game.guards[1].y = HUD_H + 12 * TILE + 20;
    game.guards[1].facing = -Math.PI / 2;
  } else if (name === 'alarm') {
    // Level 3, near-miss: the thief at a cone's edge, one guard wary (?),
    // detection high, a camera sweeping behind.
    game.loadLevel(2);
    game.state = 'play';
    placePlayer(game, 9, 4, Math.PI / 2);
    const g = game.guards[0];
    g.x = 9 * TILE + 20;
    g.y = HUD_H + 2 * TILE + 20;
    g.facing = Math.PI / 2;
    g.suspicion = 72;
    g.state = 'investigate';
    g.investigateTarget = { x: game.player.x, y: game.player.y };
    g.investigateTimer = 4;
    game.guards[1].x = 22 * TILE + 20;
    game.guards[1].y = HUD_H + 11 * TILE + 20;
    game.guards[1].facing = Math.PI;
    // A coin mid-ring to show the distraction mechanic.
    game.player.coins = 2;
    game.player.coin = { x: 13 * TILE + 20, y: HUD_H + 5 * TILE + 20, t: 4 };
  } else if (name === 'exit') {
    // Level 3 again, endgame: all relics taken, exit open and glowing,
    // camera sweeping behind the thief.
    game.loadLevel(2);
    game.state = 'play';
    for (const relic of game.world.relics) relic.taken = true;
    game.player.relics = 3;
    placePlayer(game, 24, 13, -Math.PI / 2);
    game.guards[0].x = 6 * TILE + 20;
    game.guards[0].y = HUD_H + 3 * TILE + 20;
    game.guards[0].facing = 0;
    game.guards[2].x = 20 * TILE + 20;
    game.guards[2].y = HUD_H + 6 * TILE + 20;
    game.guards[2].facing = Math.PI / 2;
  } else if (name === 'title') {
    game.state = 'title';
  }
}
