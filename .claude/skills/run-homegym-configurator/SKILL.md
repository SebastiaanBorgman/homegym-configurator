---
name: run-homegym-configurator
description: Start, run, build, test, screenshot and drive the Homegym Studio 3D homegym configurator (Vite + React Three Fiber web app). Use when asked to run the app, launch the dev server, open the configurator, add products and check the 3D/2D view or order page, take screenshots, or confirm a change works in the real app.
---

Homegym Studio is a Vite web app (React + three.js). An agent drives it by starting the dev
server, then running `.claude/skills/run-homegym-configurator/driver.mjs`. That Playwright
script opens headless **system Chrome**, clicks through the real UI, reads the app's true state
from the `window.__homegym` debug hook and saves screenshots. All paths are relative to the
project root (the folder holding `package.json`).

Verified on Windows 10, Node 25.8, with Chrome installed. Run the commands below in Git Bash.
There is no `chromium-cli` here. Playwright comes from the project's own devDependencies and
uses `channel: 'chrome'`, so no browser download is needed.

## Setup

```bash
npm install          # only if node_modules/ is missing
```

## Run (agent path)

1. Start the dev server in the background, then wait until it answers:

```bash
npm run dev          # run_in_background: true; serves http://localhost:5173
timeout 60 bash -c 'until curl -sf -o /dev/null http://localhost:5173; do sleep 1; done' && echo up
```

2. Drive it:

```bash
node .claude/skills/run-homegym-configurator/driver.mjs
```

The default `full` flow does the following:
- Opens the homepage (rotating 3D hero).
- Clears `localStorage` and opens `/configurator` on an empty 4 × 6 × 2.6 m room.
- Adds the first 3 catalogue products through their `+` buttons.
- Logs items, positions, the order total and room-check issues.
- Switches to the 2D plan.
- Reloads to confirm the design persists.
- Opens `/bestellijst` (the order page).

It exits with code 1 if any step fails or the browser logs any console error.

| flag | effect |
|---|---|
| `--flow home\|configurator\|order\|full` | Run only part of the flow. `order` shows whatever design is saved in that browser context, which starts empty in a fresh run. |
| `--products id1,id2` | Add these products instead of the first three. An unknown id fails at once and prints every valid id. |
| `--base http://localhost:4173` | Target another server, for example the production preview. |
| `--out DIR` | Screenshot folder. The default is `test-results/run-skill/`, which is gitignored. |
| `--headed` | Show the Chrome window. |

Screenshots are numbered in order (`01-home.png`, `02-configurator-empty.png`,
`03-configurator-items.png`, `04-plan-2d.png`, `05-order-page.png`). On a failure the driver
also saves `NN-failure.png`. **Open the screenshots and look at them.** A blank viewport means
WebGL did not start.

To check something the flow does not cover, copy the pattern in `driver.mjs`:
`page.getByTestId(...)` for clicks and `page.evaluate(() => window.__homegym.design())` (or
`.issues()`, `.order()`, `.scene()`, `.camera()`, `.selection()`) for state. `e2e/helpers.ts` has
`dragInScene()`, which drags via `__homegym.project(x,y,z)` to convert room coordinates to
screen pixels.

3. Stop the server by killing whatever listens on the port (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## Run against the production build

```bash
npm run build        # tsc --noEmit + vite build -> dist/
npm run preview      # run_in_background: true; http://localhost:4173 (strictPort)
timeout 60 bash -c 'until curl -sf -o /dev/null http://localhost:4173; do sleep 1; done'
node .claude/skills/run-homegym-configurator/driver.mjs --base http://localhost:4173 --out test-results/run-skill-prod
```

Stop it with the same PowerShell line, using port 4173.

## Run (human path)

Run `npm run dev` and open http://localhost:5173 in a browser. Press Ctrl-C to stop.

## Test

```bash
npm test             # vitest: 72 unit tests, ~5 s
npm run test:e2e     # vite build + 18 Playwright tests against preview on :4173, ~2 min; screenshots in test-results/screenshots/
```

## Gotchas

- **The design autosaves to `localStorage`.** A reload restores the previous design. The driver
  clears storage first. Each driver run uses a fresh browser context, so it never touches the
  user's own saved design.
- **`[data-testid^="add-"]` matches more than catalogue buttons.** The Ruimte tab has `add-door`,
  `add-window` and `add-obstacle`. Scope the selector to product cards:
  `[data-testid^="product-"] [data-testid^="add-"]`. The product id is the test id without
  `add-`.
- **Wait for the 3D scene with `window.__homegym.scene()?.floor`,** not with a page-load event.
  The canvas mounts after `load`, and `scene()` returns `null` until three.js has drawn.
- **WebGL in headless Chrome needs `--enable-unsafe-swiftshader --ignore-gpu-blocklist`.** The
  driver and `playwright.config.ts` pass both flags.
- **The first product lands in the room centre and later ones are packed beside it.** The
  default three racks in a 4 × 6 m room raise "Gebruiksruimte … is beperkt" (limited clearance)
  warnings. That is expected room-check output, not a bug.
- **Toasts ("… toegevoegd", meaning "… added") cover the top-centre of the viewport** for a few
  seconds after each add. Wait or close them before clicking in that area.
- **The preview server uses `strictPort`** (`vite.config.ts`). Stop any old preview on 4173
  before starting a new one. The dev server has `strictPort: false`, so check the port it
  prints.
- **The UI text is Dutch.** The left-panel tab test ids are `tab-catalogus`, `tab-ruimte` (room)
  and `tab-indeling` (layout); at 1440 px, Controle (checks) and Bestellijst (order list) sit in
  the right panel. The 2D toggle is `view-2d`; the order page is the route `/bestellijst`.
