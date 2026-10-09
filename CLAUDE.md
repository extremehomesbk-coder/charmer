# Snake Song (working title; repo and pipeline card: Charmer)

Mobile-web game prototype built from the studio template. Not an EHM or Halsey project: none of their data,
skills or doc routing apply here.

## Rules

- Everything original: no third-party game names, branding, art, sound or music.
- No secrets, analytics or network calls. The only persistence is `src/storage.ts` (versioned save, try/catch).
- Every tunable number goes in `src/config.ts`. Nothing numeric is hard-coded in scenes or models.
- Rules logic stays in plain TypeScript modules with Vitest tests; scenes only render and route input.
- Portrait iPhone first (390x844 design resolution, Phaser FIT). Touch-first input via `src/input.ts`,
  arrows/space fallback for desktop testing. Tap targets at least 40 px.
- Keep this file under 50 lines: rules and routing only. Design notes, changelogs and decisions go in `docs/`.

## Where things live

| Need                                                   | Read / write         |
| ------------------------------------------------------ | -------------------- |
| What the game is and why                               | `docs/DESIGN.md`     |
| The rules as built, and open assumptions               | `docs/GAME_RULES.md` |
| Every knob, its default, the gate target, playtest log | `docs/TUNING.md`     |
| Tunable numbers                                        | `src/config.ts`      |
| Save format                                            | `src/storage.ts`     |

## Run

```
npm install
npm run dev        # Vite dev server (phone on the same Wi-Fi can open the --host URL)
npm run check      # lint + prettier + typecheck + tests + build; run before every commit
```

## Deploy

Push to `main`. `.github/workflows/deploy.yml` runs the checks and deploys `dist/` to GitHub Pages
(public repos; enable Pages once with source "GitHub Actions", see README). The site lives at
`https://<owner>.github.io/<repo>/`; `vite.config.ts` uses `base: './'` so that path works.
