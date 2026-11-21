// Keyboard and mouse, read as state plus one-frame action edges. The loop asks for
// the movement axes every step and consumes actions (confirm, pause, interact,
// mute) exactly once each, so a held key never retriggers a menu or a car door.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MUTE = 8;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = new Set();
  let pending = 0;
  const mouse = { x: 0, y: 0, down: false };

  function press(code) {
    if (code === 'Enter' || code === 'Space') pending |= ACTION_CONFIRM;
    if (code === 'KeyP' || code === 'Escape') pending |= ACTION_PAUSE;
    if (code === 'KeyE') pending |= ACTION_INTERACT;
    if (code === 'KeyM') pending |= ACTION_MUTE;
  }

  window.addEventListener('keydown', (event) => {
    if (KEYMAP[event.code] || event.code === 'Space') event.preventDefault();
    if (!event.repeat) press(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  function toLocal(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  }
  canvas.addEventListener('mousemove', toLocal);
  canvas.addEventListener('mousedown', (event) => {
    toLocal(event);
    mouse.down = true;
    pending |= ACTION_CONFIRM;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    mouse,
    /** -1..1 movement axes from the held keys. */
    axisX() {
      let v = 0;
      for (const code of held) {
        if (KEYMAP[code] === 'left') v -= 1;
        if (KEYMAP[code] === 'right') v += 1;
      }
      return v;
    },
    axisY() {
      let v = 0;
      for (const code of held) {
        if (KEYMAP[code] === 'up') v -= 1;
        if (KEYMAP[code] === 'down') v += 1;
      }
      return v;
    },
    sprint() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    brake() { return held.has('Space'); },
    /** Shooting is the mouse held down, or F. */
    firing() { return mouse.down || held.has('KeyF'); },
    /** Read and clear the one-frame action edges. */
    takeActions() {
      const out = pending;
      pending = 0;
      return out;
    },
  };
}
