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
