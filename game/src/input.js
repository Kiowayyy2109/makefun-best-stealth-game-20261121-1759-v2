// Nightshade: keyboard + mouse input. Tracks held keys as a set and fires
// edge-triggered callbacks (pressed once per keydown) for actions.

export function createInput() {
  const held = new Set();
  const pressedQueue = [];
  const mouse = { x: 0, y: 0, clicked: false };

  function codeOf(e) {
    return e.code;
  }

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) pressedQueue.push(e.code);
    held.add(e.code);
  }
  function onKeyUp(e) {
    held.delete(e.code);
  }
  function onMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.clicked = true;
    pressedQueue.push('MouseClick');
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);

  return {
    held,
    mouse,
    // True while any of the given codes is held.
    any(...codes) {
      return codes.some((c) => held.has(c));
    },
    // Drain and return the codes pressed since the last call.
    drainPressed() {
      const out = pressedQueue.splice(0, pressedQueue.length);
      if (mouse.clicked) {
        mouse.clicked = false;
      }
      return out;
    },
    // Movement vector from WASD / arrows, normalised.
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
  };
}
