// Nightshade: dynamic lighting. The night museum is dark; lamps, the player
// and glowing relics punch pools of light into the darkness, and vision
// cones are drawn over the top so danger stays readable. The darkness layer
// is an offscreen canvas: fill it dark, then erase radial gradients with
// 'destination-out' wherever light falls.

export function createDarkness(width, height) {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  return layer;
}

// Rebuild the darkness overlay for one frame. `lights` is a list of
// {x, y, radius, strength} pools; cones are handled by render.js.
export function paintDarkness(layer, lights, worldTop) {
  const c = layer.getContext('2d');
  const w = layer.width;
  const h = layer.height;
  c.clearRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  // Night darkness over the play area only; the HUD stays bright.
  c.fillStyle = 'rgba(4, 7, 20, 0.52)';
  c.fillRect(0, worldTop, w, h - worldTop);
  c.globalCompositeOperation = 'destination-out';
  for (const light of lights) {
    const g = c.createRadialGradient(light.x, light.y, 8, light.x, light.y, light.radius);
    g.addColorStop(0, `rgba(0,0,0,${light.strength})`);
    g.addColorStop(0.7, `rgba(0,0,0,${light.strength * 0.55})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
}

// Warm glow pools drawn under the darkness layer (lamp light on the floor).
export function paintLampPools(ctx, lamps, time) {
  for (const lamp of lamps) {
    const flicker = 1 + Math.sin(time * 2.1 + lamp.x * 0.13) * 0.05;
    const r = 105 * flicker;
    const g = ctx.createRadialGradient(lamp.x, lamp.y, 6, lamp.x, lamp.y, r);
    g.addColorStop(0, 'rgba(255, 196, 110, 0.34)');
    g.addColorStop(0.6, 'rgba(255, 170, 80, 0.14)');
    g.addColorStop(1, 'rgba(255, 170, 80, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
