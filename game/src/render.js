// Nightshade: all drawing — floor, props, lamps, cones, entities, HUD and
// screens. The palette is a night museum: deep blue marble, gold trim, warm
// lamp light, crimson carpet. Danger must read at a glance: lit floor and
// vision cones are dangerous, dark shadow pools are safe.

import { TILE, COLS, ROWS, HUD_H } from './levels.js';
import { createDarkness, paintDarkness, paintLampPools } from './lighting.js';
import { CONE_RANGE, CONE_HALF, guardLabel } from './guards.js';
import { CAM_RANGE, CAM_HALF, laserIsOn } from './cameras.js';

const W = 1280;
const H = 720;

let darkness = null;

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function drawFloor(ctx, world, time) {
  for (const cell of world.floor) {
    const px = cell.x * TILE;
    const py = HUD_H + cell.y * TILE;
    if (cell.kind === 'carpet') {
      ctx.fillStyle = '#5d1f2a';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#6d2531';
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      // Gold carpet border on the edge cells of a carpet run.
      ctx.strokeStyle = 'rgba(212, 175, 105, 0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 6.5, py + 6.5, TILE - 13, TILE - 13);
      ctx.fillStyle = 'rgba(212, 175, 105, 0.35)';
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (cell.kind === 'shadow') {
      ctx.fillStyle = '#101830';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(120, 150, 255, 0.05)';
      for (let i = 0; i < 3; i++) {
        const sx = px + hash(cell.x, cell.y * 3 + i) * TILE;
        const sy = py + hash(cell.x * 7 + i, cell.y) * TILE;
        ctx.fillRect(sx, sy, 2, 2);
      }
    } else {
      const even = (cell.x + cell.y) % 2 === 0;
      ctx.fillStyle = even ? '#1b2342' : '#171d38';
      ctx.fillRect(px, py, TILE, TILE);
      // Tile grout + speckle.
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      const sx = px + 8 + hash(cell.x, cell.y) * 22;
      const sy = py + 8 + hash(cell.y, cell.x) * 22;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }
}

function drawWallsAndProps(ctx, world, time) {
  const def = world.def;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = def.map[y][x];
      const px = x * TILE;
      const py = HUD_H + y * TILE;
      if (ch === '#') {
        ctx.fillStyle = '#0d1126';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#232c52';
        ctx.fillRect(px, py, TILE, 8);
        ctx.fillStyle = 'rgba(212, 175, 105, 0.5)';
        ctx.fillRect(px, py + 8, TILE, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(px + 6, py + 14, TILE - 12, 3);
      } else if (ch === 'C') {
        ctx.fillStyle = '#7a5a33';
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = '#8f6c3e';
        ctx.fillRect(px + 4, py + 4, TILE - 8, 8);
        ctx.strokeStyle = '#5d4225';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.beginPath();
        ctx.moveTo(px + 4, py + TILE / 2);
        ctx.lineTo(px + TILE - 4, py + TILE / 2);
        ctx.stroke();
      } else if (ch === 'D') {
        ctx.fillStyle = '#4a3220';
        ctx.fillRect(px + 2, py + 6, TILE - 4, TILE - 16);
        ctx.fillStyle = '#6b4a2e';
        ctx.fillRect(px + 2, py + 6, TILE - 4, 6);
        ctx.fillStyle = '#d4af69';
        ctx.fillRect(px + 8, py + 16, 8, 6);
        ctx.fillRect(px + TILE - 16, py + 16, 8, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(px + 6, py + 8, TILE - 12, 2);
      } else if (ch === 'B') {
        ctx.fillStyle = '#3a2417';
        ctx.fillRect(px + 3, py + 2, TILE - 6, TILE - 4);
        const colors = ['#a33', '#3a6', '#36a', '#aa3', '#a6a'];
        for (let s = 0; s < 3; s++) {
          for (let b = 0; b < 4; b++) {
            ctx.fillStyle = colors[(b + s + x + y) % colors.length];
            ctx.fillRect(px + 6 + b * 8, py + 5 + s * 11, 6, 9);
          }
        }
      } else if (ch === 'P') {
        ctx.fillStyle = '#8a5a2e';
        ctx.fillRect(px + 13, py + 24, 14, 12);
        ctx.fillStyle = '#2f7a3d';
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.45;
          ctx.beginPath();
          ctx.ellipse(px + 20 + Math.cos(a) * 7, py + 18 + Math.sin(a) * 7, 5, 10, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#4caf5e';
        ctx.beginPath();
        ctx.arc(px + 20, py + 14, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (ch === 'S') {
        ctx.fillStyle = '#3d3a55';
        ctx.fillRect(px + 8, py + 26, 24, 10);
        ctx.fillStyle = '#c9a86a';
        ctx.beginPath();
        ctx.arc(px + 20, py + 14, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(px + 14, py + 18, 12, 10);
        ctx.fillStyle = '#e8cf96';
        ctx.beginPath();
        ctx.arc(px + 20, py + 12, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (ch === 'L') {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(px + 18, py + 14, 4, 20);
        ctx.fillStyle = '#d4af69';
        ctx.beginPath();
        ctx.arc(px + 20, py + 12, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff2c4';
        ctx.beginPath();
        ctx.arc(px + 20, py + 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawRelicsAndExit(ctx, world, time, exitOpen) {
  for (const relic of world.relics) {
    if (relic.taken) continue;
    const bob = Math.sin(time * 2.4 + relic.bob) * 3;
    const glow = ctx.createRadialGradient(relic.x, relic.y + bob, 2, relic.x, relic.y + bob, 34);
    glow.addColorStop(0, 'rgba(255, 205, 90, 0.5)');
    glow.addColorStop(1, 'rgba(255, 205, 90, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(relic.x, relic.y + bob, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(relic.x, relic.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = '#8a6a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.fillStyle = '#fff0b0';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  const e = world.exit;
  const pulse = 0.5 + Math.sin(time * 3) * 0.2;
  if (exitOpen) {
    const glow = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, 60);
    glow.addColorStop(0, `rgba(80, 255, 140, ${0.5 * pulse + 0.25})`);
    glow.addColorStop(1, 'rgba(80, 255, 140, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12351f';
    ctx.fillRect(e.x - 16, e.y - 18, 32, 36);
    ctx.strokeStyle = '#4dff88';
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x - 16, e.y - 18, 32, 36);
    ctx.fillStyle = '#4dff88';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', e.x, e.y - 24);
  } else {
    ctx.fillStyle = '#1a1214';
    ctx.fillRect(e.x - 16, e.y - 18, 32, 36);
    ctx.strokeStyle = '#7a2a30';
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x - 16, e.y - 18, 32, 36);
    ctx.fillStyle = '#c94a52';
    ctx.beginPath();
    ctx.arc(e.x, e.y + 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(e.x - 2, e.y + 2, 4, 8);
    ctx.fillStyle = '#c94a52';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOCKED', e.x, e.y - 24);
  }
}

function drawCone(ctx, x, y, facing, range, half, color, edge) {
  const g = ctx.createRadialGradient(x, y, 10, x, y, range);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - half, facing + half);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(facing - half) * range, y + Math.sin(facing - half) * range);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(facing + half) * range, y + Math.sin(facing + half) * range);
  ctx.stroke();
}

function drawGuard(ctx, g, time) {
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(g.x, g.y + 10, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: dark navy uniform with gold trim.
  ctx.fillStyle = '#2b3a67';
  ctx.beginPath();
  ctx.arc(g.x, g.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4af69';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Helmet.
  ctx.fillStyle = '#1a2440';
  ctx.beginPath();
  ctx.arc(g.x, g.y - 3, 8, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#d4af69';
  ctx.fillRect(g.x - 8, g.y - 4, 16, 2);
  // Facing tick.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + Math.cos(g.facing) * 18, g.y + Math.sin(g.facing) * 18);
  ctx.stroke();
  // Suspicion label.
  const label = guardLabel(g);
  if (label) {
    const alert = label === '!';
    ctx.fillStyle = alert ? '#ff3b30' : '#ffb340';
    ctx.beginPath();
    ctx.arc(g.x, g.y - 26, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, g.x, g.y - 25);
    ctx.textBaseline = 'alphabetic';
  }
  // Suspicion arc under the guard.
  if (g.suspicion > 2) {
    ctx.strokeStyle = g.suspicion >= 100 ? '#ff3b30' : '#ffb340';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 19, -Math.PI / 2, -Math.PI / 2 + (g.suspicion / 100) * Math.PI * 2);
    ctx.stroke();
  }
}

function drawCamera(ctx, cam, time) {
  ctx.fillStyle = '#20263f';
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cam.suspicion >= 100 ? '#ff3b30' : '#8a94b8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = cam.suspicion > 30 ? '#ff3b30' : '#ff5a4a';
  ctx.beginPath();
  ctx.arc(cam.x + Math.cos(cam.facing) * 4, cam.y + Math.sin(cam.facing) * 4, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, p, time) {
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 10, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Noise ring while running.
  if (p.noiseFlash > 0) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${p.noiseFlash * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.noise, 0, Math.PI * 2);
    ctx.stroke();
  }
  const crouch = p.sneaking ? 0.82 : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, crouch);
  // Cloak.
  ctx.fillStyle = '#6b4fa1';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4af69';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Hood + face shadow.
  ctx.fillStyle = '#4a3572';
  ctx.beginPath();
  ctx.arc(Math.cos(p.facing) * 3, Math.sin(p.facing) * 3 - 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(Math.cos(p.facing) * 6, Math.sin(p.facing) * 6 - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Sneak indicator.
  if (p.sneaking) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAK', p.x, p.y - 20);
  }
}

function drawLasers(ctx, world, time) {
  for (const run of world.runs) {
    const on = laserIsOn(run, time);
    const x0 = run.x0 * TILE + 4;
    const x1 = (run.x1 + 1) * TILE - 4;
    const y = HUD_H + run.y * TILE + TILE / 2;
    ctx.save();
    if (on) {
      ctx.strokeStyle = 'rgba(255, 40, 50, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff2832';
      ctx.shadowBlur = 8;
    } else {
      ctx.strokeStyle = 'rgba(255, 40, 50, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 8]);
    }
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.restore();
    // Emitter posts.
    ctx.fillStyle = '#3a3f55';
    ctx.fillRect(run.x0 * TILE + 2, y - 6, 5, 12);
    ctx.fillRect((run.x1 + 1) * TILE - 7, y - 6, 5, 12);
  }
}

function drawCoin(ctx, coin, time) {
  if (!coin) return;
  const pulse = 0.6 + Math.sin(time * 6) * 0.25;
  ctx.strokeStyle = `rgba(255, 230, 140, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(coin.x, coin.y, 26 + Math.sin(time * 6) * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f5c542';
  ctx.beginPath();
  ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6a1a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function renderGame(ctx, game) {
  if (!darkness) darkness = createDarkness(W, H);
  const { world, player, guards, cameras, time } = game;
  const exitOpen = player.relics >= 3;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0e20';
  ctx.fillRect(0, 0, W, H);

  drawFloor(ctx, world, time);
  paintLampPools(ctx, world.lamps, time);
  drawWallsAndProps(ctx, world, time);
  drawRelicsAndExit(ctx, world, time, exitOpen);
  drawLasers(ctx, world, time);
  drawCoin(ctx, player.coin, time);

  // Darkness with light pools around lamps, player, relics and the open exit.
  const lights = [
    ...world.lamps.map((l) => ({ x: l.x, y: l.y, radius: 130, strength: 0.95 })),
    { x: player.x, y: player.y, radius: 120, strength: 0.9 },
    ...world.relics.filter((r) => !r.taken).map((r) => ({ x: r.x, y: r.y, radius: 55, strength: 0.7 })),
  ];
  if (exitOpen) lights.push({ x: world.exit.x, y: world.exit.y, radius: 90, strength: 0.8 });
  paintDarkness(darkness, lights, HUD_H);
  ctx.drawImage(darkness, 0, 0);

  // Vision cones over the darkness so danger stays readable.
  for (const g of guards) {
    const alert = g.suspicion >= 100 || g.state === 'chase';
    const wary = g.suspicion >= 30;
    drawCone(ctx, g.x, g.y, g.facing, CONE_RANGE, CONE_HALF,
      alert ? 'rgba(255, 60, 50, 0.30)' : wary ? 'rgba(255, 170, 60, 0.24)' : 'rgba(255, 220, 120, 0.20)',
      alert ? 'rgba(255, 60, 50, 0.5)' : 'rgba(255, 220, 120, 0.3)');
  }
  for (const cam of cameras) {
    drawCone(ctx, cam.x, cam.y, cam.facing, CAM_RANGE, CAM_HALF,
      cam.suspicion >= 100 ? 'rgba(255, 60, 50, 0.30)' : 'rgba(255, 120, 120, 0.22)',
      'rgba(255, 120, 120, 0.35)');
  }

  for (const cam of cameras) drawCamera(ctx, cam, time);
  for (const g of guards) drawGuard(ctx, g, time);
  drawPlayer(ctx, player, time);

  drawHUD(ctx, game);
}

function drawHUD(ctx, game) {
  const { player, levelIndex, levelTime, maxSuspicion, alarm } = game;
  // Top bar.
  const grad = ctx.createLinearGradient(0, 0, 0, HUD_H);
  grad.addColorStop(0, '#141a33');
  grad.addColorStop(1, '#0d1126');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = '#d4af69';
  ctx.fillRect(0, HUD_H - 2, W, 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8cf96';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('NIGHTSHADE', 18, 24);
  ctx.fillStyle = '#8a94b8';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Level ${levelIndex + 1} — ${game.levelDef.short}`, 18, 50);

  // Relics.
  const rx = 560;
  ctx.fillStyle = '#8a94b8';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('RELICS', rx, 22);
  for (let i = 0; i < 3; i++) {
    const cx = rx + 14 + i * 30;
    const cy = 50;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < player.relics ? '#f5c542' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = i < player.relics ? '#8a6a1a' : '#555';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
  }

  // Coins.
  ctx.fillStyle = '#8a94b8';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('COINS (Q)', 700, 22);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < player.coins ? '#f5c542' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(716 + i * 22, 50, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Timer.
  const t = Math.floor(levelTime);
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  ctx.fillStyle = '#8a94b8';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('TIME', 830, 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`${mm}:${ss}`, 830, 50);

  // Detection meter.
  ctx.fillStyle = '#8a94b8';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('DETECTION', 950, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(950, 42, 180, 12);
  const susp = Math.max(0, Math.min(100, maxSuspicion));
  ctx.fillStyle = susp >= 100 ? '#ff3b30' : susp >= 30 ? '#ffb340' : '#4dff88';
  ctx.fillRect(950, 42, 180 * (susp / 100), 12);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(950.5, 42.5, 180, 12);
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText(susp >= 100 ? 'SPOTTED!' : susp >= 30 ? 'SUSPICIOUS' : 'UNSEEN', 950, 66);

  // Alarm banner.
  if (alarm) {
    ctx.fillStyle = 'rgba(255, 40, 40, 0.92)';
    ctx.fillRect(0, HUD_H, W, 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠  ALARM — THEY KNOW WHERE YOU ARE — BREAK LINE OF SIGHT  ⚠', W / 2, HUD_H + 14);
    ctx.textAlign = 'left';
  }

  // Bottom hint bar.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, H - 24, W, 24);
  ctx.fillStyle = '#aab4d8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move   •   SHIFT sneak   •   SPACE run (loud)   •   Q toss a coin   •   E pick up   •   R restart   •   M mute   •   P pause', W / 2, H - 8);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // "Press E" prompt near a relic.
  const near = game.world.relics.find((r) => !r.taken && Math.hypot(game.player.x - r.x, game.player.y - r.y) < 46);
  if (near) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const label = 'Press E — take the relic';
    ctx.font = 'bold 13px sans-serif';
    const wdt = ctx.measureText(label).width + 20;
    ctx.fillRect(near.x - wdt / 2, near.y - 52, wdt, 24);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(label, near.x, near.y - 35);
    ctx.textAlign = 'left';
  }
}

function panel(ctx, title, lines, foot, accent) {
  ctx.fillStyle = 'rgba(4, 6, 18, 0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#101736';
  ctx.strokeStyle = accent || '#d4af69';
  ctx.lineWidth = 2;
  const pw = 720;
  const ph = 150 + lines.length * 30;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 12);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8cf96';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(title, W / 2, py + 58);
  ctx.fillStyle = '#cdd5f0';
  ctx.font = '16px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, py + 102 + i * 30));
  if (foot) {
    ctx.fillStyle = '#8a94b8';
    ctx.font = '14px sans-serif';
    ctx.fillText(foot, W / 2, py + ph - 22);
  }
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, time) {
  ctx.fillStyle = '#070a16';
  ctx.fillRect(0, 0, W, H);
  // Decorative moon + skyline.
  const moon = ctx.createRadialGradient(1020, 130, 10, 1020, 130, 120);
  moon.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
  moon.addColorStop(0.3, 'rgba(255, 220, 150, 0.35)');
  moon.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.fillStyle = moon;
  ctx.fillRect(880, 0, 280, 260);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(1020, 130, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d1126';
  for (let i = 0; i < 12; i++) {
    const bw = 70 + ((i * 37) % 60);
    ctx.fillRect(60 + i * 105, 560 - ((i * 53) % 120), bw, 160);
    ctx.fillStyle = 'rgba(255, 200, 100, 0.7)';
    for (let wnd = 0; wnd < 3; wnd++) {
      if ((i + wnd) % 2 === 0) ctx.fillRect(70 + i * 105 + wnd * 22, 580 - ((i * 53) % 120), 8, 10);
    }
    ctx.fillStyle = '#0d1126';
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8cf96';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('NIGHTSHADE', W / 2, 240);
  ctx.fillStyle = '#d4af69';
  ctx.font = '28px Georgia, serif';
  ctx.fillText('— The Gilded Vault —', W / 2, 288);
  ctx.fillStyle = '#cdd5f0';
  ctx.font = '17px sans-serif';
  ctx.fillText('A top-down stealth heist. Four vaults. Twelve relics. One unseen thief.', W / 2, 340);
  ctx.fillText('Slip past the guards, dodge the cameras, and reach the exit unseen.', W / 2, 366);
  const blink = 0.6 + Math.sin(time * 3) * 0.4;
  ctx.fillStyle = `rgba(255, 233, 168, ${blink})`;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER to begin', W / 2, 440);
  ctx.fillStyle = '#8a94b8';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD move  •  SHIFT sneak  •  SPACE run  •  Q toss a coin  •  E pick up  •  R restart  •  M mute', W / 2, 500);
  ctx.textAlign = 'left';
}

export function drawBrief(ctx, levelDef) {
  panel(ctx, levelDef.name, [levelDef.brief, '', levelDef.hint], 'Press ENTER to start the heist', '#d4af69');
}

export function drawClear(ctx, game) {
  panel(ctx, 'VAULT CLEARED', [
    `${game.levelDef.short} — all three relics secured.`,
    `Time: ${formatTime(game.levelTime)}   •   Score: ${game.score}`,
    '',
    game.levelIndex + 1 < 4 ? 'Next: ' + game.nextLevelName : 'That was the last vault.',
  ], 'Press ENTER for the next vault', '#4dff88');
}

export function drawWin(ctx, game) {
  panel(ctx, 'THE GILDED VAULT IS YOURS', [
    'All four vaults cleared. Twelve relics. Never once caught — a ghost.',
    `Total time: ${formatTime(game.totalTime)}   •   Final score: ${game.score}`,
    '',
    'Nightshade vanishes into the night. The museum never knew.',
  ], 'Press ENTER to play again', '#f5c542');
}

export function drawCaught(ctx) {
  panel(ctx, 'CAUGHT!', [
    'A guard laid hands on you — or a camera held your face too long.',
    'The vault doors slam shut. The night is over… for now.',
  ], 'Press R to retry the level', '#ff3b30');
}

export function drawPaused(ctx) {
  panel(ctx, 'PAUSED', ['The guards wait. The night holds its breath.'], 'Press P to resume', '#8a94b8');
}

export function formatTime(t) {
  const s = Math.floor(t);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
