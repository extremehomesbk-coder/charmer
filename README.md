# studio-template

Starter for mobile-web game prototypes: Phaser 3 + TypeScript + Vite, portrait iPhone layout, touch-first input,
one config file for every tunable number, versioned localStorage save, Vitest + ESLint + Prettier + tsc, and a
GitHub Actions workflow that checks every push and deploys `main` to GitHub Pages.

## Start a new game in 3 steps

Set the game's slug once (lowercase, hyphens, no brackets), then run the blocks as they are.

PowerShell:

```
$g = "my-game"
gh repo create extremehomesbk-coder/$g --public --template extremehomesbk-coder/studio-template --clone
cd $g; npm install
```

```
gh api -X POST repos/extremehomesbk-coder/$g/pages -f build_type=workflow
git commit --allow-empty -m "first deploy"; git push
```

The game is live at `https://extremehomesbk-coder.github.io/<slug>/` about a minute later.

Then rename and fill the docs: `title` in `src/config.ts`, `<title>` in `index.html`, the first line of
`CLAUDE.md`, `docs/DESIGN.md` before writing code. Replace `src/scenes/GameScene.ts` with the real game.

(bash/zsh: `g=my-game` and `$g` the same way; `&&` instead of `;`.)

## Day to day

```
npm run dev      # local server; add --host to open it from a phone on the same Wi-Fi
npm run check    # lint, prettier, typecheck, tests, build
```

Rules for working in a repo made from this template are in `CLAUDE.md`.
