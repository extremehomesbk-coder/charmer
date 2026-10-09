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
 * Press-and-hold input: reports which lane (column) the finger or mouse is holding, following the finger as it
 * slides, and null on release. Keys 1..9 hold lanes on desktop. laneAt maps a world point to a lane or null.
 */
export function bindHold(
  scene: Phaser.Scene,
  laneAt: (x: number, y: number) => number | null,
  onHold: (lane: number | null) => void,
  lanes: number,
): void {
  let pointerId: number | null = null;
  const keysDown: number[] = [];
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    const lane = laneAt(p.worldX, p.worldY);
    if (lane === null) return;
    pointerId = p.id;
    onHold(lane);
  });
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (p.id !== pointerId || !p.isDown) return;
    const lane = laneAt(p.worldX, p.worldY);
    if (lane !== null) onHold(lane);
  });
  const release = (p: Phaser.Input.Pointer) => {
    if (p.id !== pointerId) return;
    pointerId = null;
    onHold(keysDown.length ? keysDown[keysDown.length - 1] : null);
  };
  scene.input.on('pointerup', release);
  scene.input.on('pointerupoutside', release);
  const kb = scene.input.keyboard;
  if (!kb) return;
  kb.on('keydown', (e: KeyboardEvent) => {
    const lane = Number(e.key) - 1;
    if (!Number.isInteger(lane) || lane < 0 || lane >= lanes || keysDown.includes(lane)) return;
    keysDown.push(lane);
    onHold(lane);
  });
  kb.on('keyup', (e: KeyboardEvent) => {
    const lane = Number(e.key) - 1;
    const i = keysDown.indexOf(lane);
    if (i < 0) return;
    keysDown.splice(i, 1);
    if (pointerId === null) onHold(keysDown.length ? keysDown[keysDown.length - 1] : null);
  });
}
