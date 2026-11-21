// Nightshade — The Gilded Vault: bootstrap, state machine, and game loop.
// States: title → brief → play ⇄ pause → clear → brief … → win, or caught.
// The loop is a fixed canvas (1280x720); dt is clamped so tab stalls never
// teleport the thief. Exposes window.NIGHTSHADE for debugging and testing.

import { LEVELS, TILE, HUD_H } from './levels.js';
import { parseLevel } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer, throwCoin, detectionFactor } from './player.js';
import { createGuard, updateGuard } from './guards.js';
import { createCamera, updateCamera, laserIsOn, playerOnLaser } from './cameras.js';
import { renderGame, drawTitle, drawBrief, drawClear, drawWin, drawCaught, drawPaused } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput();
const audio = createAudio();

const game = {
  state: 'title',
  levelIndex: 0,
  levelDef: LEVELS[0],
  world: null,
  player: null,
  guards: [],
  cameras: [],
  time: 0,
  levelTime: 0,
  totalTime: 0,
  score: 0,
  alarm: false,
  alarmTimer: 0,
  laserCooldown: 0,
  maxSuspicion: 0,
  playerFactor: 1,
  pressed: [],
  nextLevelName: '',
};

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

game.loadLevel = function loadLevel(index) {
  game.levelIndex = index;
  game.levelDef = LEVELS[index];
  game.world = parseLevel(game.levelDef);
  game.player = createPlayer(game.world.player);
  game.guards = game.levelDef.guards.map((def, i) =>
    createGuard(def, game.world.guardSpawns[i] || game.world.player));
  game.cameras = game.levelDef.cameras.map((def, i) =>
    createCamera(def, game.world.cameraSpawns[i] || game.world.player));
  game.levelTime = 0;
  game.alarm = false;
  game.alarmTimer = 0;
  game.laserCooldown = 0;
  game.maxSuspicion = 0;
  game.nextLevelName = index + 1 < LEVELS.length ? LEVELS[index + 1].short : '';
  announce(`${game.levelDef.name}. Steal three relics, then reach the exit unseen.`);
};

game.onRelic = function onRelic(count) {
  game.score += 100;
  if (count >= 3) {
    audio.unlockExit();
    announce('All relics taken. The exit is open — go!');
  }
};

game.onSpotted = function onSpotted() {
  if (game.state !== 'play') return;
  game.alarm = true;
  game.alarmTimer = 5;
  for (const g of game.guards) {
    g.state = 'chase';
    g.suspicion = 100;
    g.lastSeen = { x: game.player.x, y: game.player.y };
    g.lostTimer = 0;
  }
  audio.alert();
  announce('Spotted! Alarm raised — break line of sight!');
};

game.onCaught = function onCaught() {
  if (game.state !== 'play') return;
  game.state = 'caught';
  audio.caught();
  audio.stopHum();
  announce('Caught! Press R to retry the level.');
};

function tripLaser() {
  if (game.laserCooldown > 0) return;
  game.laserCooldown = 1.5;
  game.onSpotted();
  announce('Laser tripwire! Alarm raised!');
}

function levelClear() {
  const timeBonus = Math.max(0, 300 - Math.floor(game.levelTime) * 2);
  game.score += timeBonus + game.player.coins * 25;
  game.totalTime += game.levelTime;
  audio.win();
  audio.stopHum();
  if (game.levelIndex + 1 >= LEVELS.length) {
    game.state = 'win';
    announce(`You cleared every vault. Final score ${game.score}.`);
  } else {
    game.state = 'clear';
    announce(`${game.levelDef.short} cleared. Score ${game.score}.`);
  }
}

function updatePlay(dt) {
  game.time += dt;
  game.levelTime += dt;
  game.laserCooldown = Math.max(0, game.laserCooldown - dt);
  game.playerFactor = detectionFactor(game.player, game.world);

  updatePlayer(game.player, input, game.world, game, dt, audio);

  let maxS = 0;
  for (const g of game.guards) {
    updateGuard(g, game.world, game.player, dt, game, audio);
    maxS = Math.max(maxS, g.suspicion);
  }
  for (const cam of game.cameras) {
    updateCamera(cam, game.world, game.player, dt, game);
    maxS = Math.max(maxS, cam.suspicion);
  }
  game.maxSuspicion = maxS;

  // Laser tripwires.
  const run = playerOnLaser(game.world, game.player);
  if (run && laserIsOn(run, game.time)) tripLaser();

  // Alarm decay: break line of sight for a while and the hunt cools off.
  if (game.alarm) {
    const anySees = game.guards.some((g) => g.state === 'chase' && g.suspicion >= 100) &&
      game.maxSuspicion >= 100;
    if (anySees) game.alarmTimer = 5;
    else game.alarmTimer -= dt;
    if (game.alarmTimer <= 0) {
      game.alarm = false;
      for (const g of game.guards) {
        if (g.state === 'chase') {
          g.state = 'search';
          g.searchTimer = 5;
        }
      }
    }
  }

  // Exit: unlocked once all three relics are taken.
  if (game.player.relics >= 3) {
    const d = Math.hypot(game.player.x - game.world.exit.x, game.player.y - game.world.exit.y);
    if (d < 30) levelClear();
  }
}

function handlePressed() {
  const pressed = game.pressed;
  if (pressed.includes('KeyM')) {
    const muted = audio.toggleMute();
    announce(muted ? 'Muted.' : 'Sound on.');
  }
  if (game.state === 'title') {
    if (pressed.includes('Enter')) {
      game.loadLevel(0);
      game.score = 0;
      game.totalTime = 0;
      game.state = 'brief';
      audio.unlock();
    }
    return;
  }
  if (game.state === 'brief') {
    if (pressed.includes('Enter')) {
      game.state = 'play';
      audio.unlock();
      audio.startHum();
    }
    return;
  }
  if (game.state === 'clear') {
    if (pressed.includes('Enter')) {
      game.loadLevel(game.levelIndex + 1);
      game.state = 'brief';
    }
    return;
  }
  if (game.state === 'win') {
    if (pressed.includes('Enter')) {
      game.loadLevel(0);
      game.score = 0;
      game.totalTime = 0;
      game.state = 'brief';
    }
    return;
  }
  if (game.state === 'caught') {
    if (pressed.includes('KeyR') || pressed.includes('Enter')) {
      game.loadLevel(game.levelIndex);
      game.state = 'play';
      audio.startHum();
    }
    return;
  }
  if (game.state === 'pause') {
    if (pressed.includes('KeyP') || pressed.includes('Escape')) game.state = 'play';
    return;
  }
  // play state
  if (pressed.includes('KeyP') || pressed.includes('Escape')) {
    game.state = 'pause';
    return;
  }
  if (pressed.includes('KeyR')) {
    game.loadLevel(game.levelIndex);
    return;
  }
  if (pressed.includes('KeyQ')) throwCoin(game.player, audio);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  game.pressed = input.drainPressed();
  handlePressed();
  if (game.state === 'play') updatePlay(dt);
  else if (game.state === 'title' || game.state === 'brief') game.time += dt;

  if (game.state === 'title') drawTitle(ctx, game.time);
  else if (game.state === 'brief') {
    renderGame(ctx, game);
    drawBrief(ctx, game.levelDef);
  } else if (game.state === 'clear') {
    renderGame(ctx, game);
    drawClear(ctx, game);
  } else if (game.state === 'win') {
    renderGame(ctx, game);
    drawWin(ctx, game);
  } else if (game.state === 'caught') {
    renderGame(ctx, game);
    drawCaught(ctx);
  } else if (game.state === 'pause') {
    renderGame(ctx, game);
    drawPaused(ctx);
  } else {
    renderGame(ctx, game);
  }
  window.__ready = true;
  requestAnimationFrame(frame);
}

// Boot: title screen, or a staged shot for screenshots (?shot=start|alarm|exit|title).
game.loadLevel(0);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(game, shot);
  if (game.state === 'play') audio.unlock();
} else {
  game.state = 'title';
}

window.NIGHTSHADE = game;
requestAnimationFrame(frame);
