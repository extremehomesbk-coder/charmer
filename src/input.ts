import Phaser from 'phaser';

export type Dir = 'left' | 'right' | 'up' | 'down';

export interface InputHandlers {
  onTap?: (x: number, y: number) => void;
  onSwipe?: (dir: Dir) => void;
  onAction?: () => void;
}

/**
 * Touch-first input with a desktop fallback: taps and swipes on the canvas; arrows map to swipes and
 * space/enter to the action. Call once from a scene's create().
 */
export function bindInput(scene: Phaser.Scene, h: InputHandlers, swipeMinPx = 24): void {
  let downX = 0;
  let downY = 0;
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    downX = p.worldX;
    downY = p.worldY;
  });
  scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
    const dx = p.worldX - downX;
    const dy = p.worldY - downY;
    if (Math.abs(dx) < swipeMinPx && Math.abs(dy) < swipeMinPx) {
      h.onTap?.(p.worldX, p.worldY);
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) h.onSwipe?.(dx > 0 ? 'right' : 'left');
    else h.onSwipe?.(dy > 0 ? 'down' : 'up');
  });
  const kb = scene.input.keyboard;
  if (!kb) return;
  kb.on('keydown-LEFT', () => h.onSwipe?.('left'));
  kb.on('keydown-RIGHT', () => h.onSwipe?.('right'));
  kb.on('keydown-UP', () => h.onSwipe?.('up'));
  kb.on('keydown-DOWN', () => h.onSwipe?.('down'));
  kb.on('keydown-SPACE', () => h.onAction?.());
  kb.on('keydown-ENTER', () => h.onAction?.());
}

/**
 * Press-and-hold input: reports which lane the player is holding, following a finger as it slides, and null
 * when every finger is up. With two thumbs down, the finger that touched (or moved) last wins, and lifting it
 * hands the flute back to the other one. Keys 1..9 hold lanes on desktop. laneAt maps a world point to a lane
 * or null.
 */
export function bindHold(
  scene: Phaser.Scene,
  laneAt: (x: number, y: number) => number | null,
  onHold: (lane: number | null) => void,
  lanes: number,
): void {
  const fingers: { id: number; lane: number }[] = []; // latest last
  const keysDown: number[] = [];
  const current = () => {
    if (fingers.length) return fingers[fingers.length - 1].lane;
    return keysDown.length ? keysDown[keysDown.length - 1] : null;
  };
  const press = (id: number, lane: number) => {
    const i = fingers.findIndex((f) => f.id === id);
    if (i >= 0) fingers.splice(i, 1);
    fingers.push({ id, lane });
    onHold(current());
  };
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    const lane = laneAt(p.worldX, p.worldY);
    if (lane !== null) press(p.id, lane);
  });
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    const f = fingers.find((x) => x.id === p.id);
    if (!f || !p.isDown) return;
    const lane = laneAt(p.worldX, p.worldY);
    if (lane !== null && lane !== f.lane) press(p.id, lane);
  });
  const release = (p: Phaser.Input.Pointer) => {
    const i = fingers.findIndex((f) => f.id === p.id);
    if (i < 0) return;
    fingers.splice(i, 1);
    onHold(current());
  };
  scene.input.on('pointerup', release);
  scene.input.on('pointerupoutside', release);
  const kb = scene.input.keyboard;
  if (!kb) return;
  kb.on('keydown', (e: KeyboardEvent) => {
    const lane = Number(e.key) - 1;
    if (!Number.isInteger(lane) || lane < 0 || lane >= lanes || keysDown.includes(lane)) return;
    keysDown.push(lane);
    onHold(current());
  });
  kb.on('keyup', (e: KeyboardEvent) => {
    const i = keysDown.indexOf(Number(e.key) - 1);
    if (i < 0) return;
    keysDown.splice(i, 1);
    onHold(current());
  });
}
