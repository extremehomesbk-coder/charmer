import Phaser from 'phaser';
import { CONFIG } from './config';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: CONFIG.colors.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Rendered at renderScale x the design size; each scene's camera zooms by the same factor.
    width: CONFIG.layout.width * CONFIG.layout.renderScale,
    height: CONFIG.layout.height * CONFIG.layout.renderScale,
  },
  render: { antialias: true },
  input: { activePointers: 2 },
  scene: [MenuScene, GameScene],
});
