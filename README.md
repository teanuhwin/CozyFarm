# 🌾 Cozy Farm

A cozy idle farming game that runs entirely in your browser — no server, no login, no install required. Plant crops, harvest them when they're ready, sell for coins, and grow your farm.

---

## How to Play

1. **Select a crop** from the toolbar at the top of the Farm tab
2. **Tap an empty plot** (🟫) to plant — costs 1 seed
3. **Wait** for the progress bar to fill — crops grow in real time, even when the tab is closed
4. **Tap a ready plot** (🌾 🌽 🎃 🍄) to harvest and add it to your barn
5. **Go to the Shop** to sell your harvest, buy more seeds, and purchase supplies
6. **Expand your farm** by buying more rows and columns

Tap a **growing plot** to apply water or fertilizer, or to check how much time is left.

---

## Crops

| Crop | Grow Time | Seed Cost | Sell Price | Unlocks At |
|------|-----------|-----------|------------|------------|
| 🌾 Wheat | 2 min | 🪙5 | 🪙10 | Start |
| 🌽 Corn | 8 min | 🪙15 | 🪙40 | 200🪙 lifetime |
| 🎃 Pumpkin | 15 min | 🪙25 | 🪙80 | 500🪙 lifetime |
| 🍄 Truffle | 45 min | 🪙50 | 🪙220 | 1500🪙 lifetime |

Crops unlock automatically as you earn coins over time. A toast notification fires the moment a new crop becomes available.

---

## Supplies

| Item | Cost | Effect |
|------|------|--------|
| 💧 Water | 🪙6 each | Apply to one growing plot — 35% faster grow time |
| 🚿 Water Hose | 🪙130 | Waters every growing plot on the farm instantly |
| 🌿 Fertilizer | 🪙8 each | Apply to one growing plot — +2 yield on harvest |
| 🧺 Big Fertilizer | 🪙160 | Fertilizes every growing plot on the farm instantly |
| 🧤 Gloves | 🪙80 | 20 uses — 60% chance to recover 1 seed on each harvest |

Water and fertilizer can be stacked on the same plot. Gloves durability is shown in the header when equipped and disappears when they break.

---

## Barn & Expansion

**Barn** holds your harvested crops before selling. Default cap is 20. Harvest is blocked when the barn is full — sell first.

| Barn Level | Capacity | Cost |
|------------|----------|------|
| Base | 20 | — |
| Level 1 | 40 | 🪙60 |
| Level 2 | 60 | 🪙150 |
| Level 3 (max) | 100 | 🪙350 |

**Farm grid** starts at 2×2 and expands up to 6×6. Each expansion adds a full row or column.

| Expansion | Cost |
|-----------|------|
| 1st | 🪙50 |
| 2nd | 🪙125 |
| 3rd | 🪙313 |
| 4th | 🪙781 |
| … | ×2.5 each time |

---

## Header At a Glance

| Pill | Meaning |
|------|---------|
| 🪙 | Current coins |
| 🌱 | Total seeds in inventory (all types) |
| 🏚️ | Barn used / capacity |
| 🧤 | Gloves durability remaining (only shown when equipped) |

---

## Settings

- **🌗 Dark / Light mode** — dark by default
- **📳 Vibrate on ready** — haptic pulse when a crop finishes growing (mobile only)
- **🗑️ Reset save data** — wipe all progress and start fresh (requires confirmation)

---

## Hosting on GitHub Pages

1. Create a new GitHub repository (e.g. `cozy-farm`)
2. Add `index.html` to the root of the repo
3. Go to **Settings → Pages**
4. Set source to **Deploy from a branch**, select `main`, folder `/root`
5. Save — your game will be live at `https://yourusername.github.io/cozy-farm`

To use a custom domain, add it under **Settings → Pages → Custom domain** and point your DNS CNAME to `yourusername.github.io`.

---

## Technical Details

- Single `index.html` file — HTML, CSS, and JavaScript, no build step, no dependencies
- All game state stored in `localStorage` under the key `cozyfarm_state`
- Settings stored under `cozyfarm_settings`
- Growth uses `Date.now()` timestamps — crops grow in real time while the tab is closed
- Save migration runs on load to handle older save formats gracefully
- Vibration uses the [Web Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) — silently ignored on desktop

---

## Roadmap

- 🤖 Auto-harvester upgrade
- 🔁 Auto-planter upgrade
- 📈 Market price upgrades (permanent sell price boosts per crop)
- 🏆 Achievements and milestones
- 🌟 Prestige / season system
- 🔔 PWA push notifications when crops are ready
- ☀️ Weather events (daily buffs/debuffs)
