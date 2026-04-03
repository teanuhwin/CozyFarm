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

Tap a **growing plot** to apply water or fertilizer, or to check how much time is left. Tapping a ready plot while in water or fertilizer mode will harvest it automatically.

---

## Crops

| Crop | Grow Time | Seed Cost | Sell Price | Unlocks At |
|------|-----------|-----------|------------|------------|
| 🌾 Wheat | 2 min | 🪙5 | 🪙10 | Start |
| 🌽 Corn | 8 min | 🪙15 | 🪙40 | 200🪙 lifetime |
| 🎃 Pumpkin | 15 min | 🪙25 | 🪙80 | 500🪙 lifetime |
| 🍄 Truffle | 45 min | 🪙50 | 🪙220 | 1500🪙 lifetime |

Crops unlock automatically as you earn coins over time. Undiscovered crops are hidden in the Shop — both in the Seeds section and the Sell Crops section — until unlocked. A toast notification fires the moment a new crop becomes available.

---

## Weather

Weather changes every hour and affects all growing plots. A banner at the top of the Farm tab shows the current condition and a countdown to the next change.

| Weather | Effect |
|---------|--------|
| 🌤️ Clear | No effect |
| ☀️ Sunny | Crops grow 20% faster |
| ☁️ Overcast | Crops grow 20% slower |
| 🌧️ Rain | All unwatered plots are watered for free |
| ⛈️ Thunderstorm | 1–5 random occupied plots are destroyed |
| 🌊 Flood | One row of crops is wiped out (rare) |

Calm weather is most common; floods are rare. Weather history is tracked in the Log tab.

---

## Supplies

Supplies are hidden until you've earned 50 lifetime coins. Bulk tools (Hose, Big Fertilizer) are only available once your farm has reached its maximum size (6×6).

| Item | Cost | Effect | Unlocks |
|------|------|--------|---------|
| 💧 Water | 🪙6 each | Apply to one growing plot — 35% faster grow time | 50🪙 lifetime |
| 🌿 Fertilizer | 🪙8 each | Apply to one growing plot — +2 yield on harvest | 50🪙 lifetime |
| 🚿 Water Hose | 🪙200 | Waters every growing plot instantly | Max farm size (6×6) |
| 🧺 Big Fertilizer | 🪙280 | Fertilizes every growing plot instantly | Max farm size (6×6) |
| 🧤 Gloves | 🪙80 | 20 uses — 60% chance to recover 1 seed on each harvest | 20 wheat harvested |

Water and fertilizer can be stacked on the same plot. Gloves durability is shown in the header when equipped.

---

## Barn & Expansion

**Barn** holds your harvested crops before selling. Harvest is blocked when the barn is full — sell first.

| Barn Level | Capacity | Cost |
|------------|----------|------|
| Base | 20 | — |
| Level 1 | 40 | 🪙60 |
| Level 2 | 60 | 🪙150 |
| Level 3 (max) | 100 | 🪙350 |

**Farm grid** starts at 2×2 and expands up to 6×6. Each expansion adds a full row or column. Cost multiplies by ×2.5 with each purchase.

| Expansion | Cost |
|-----------|------|
| 1st | 🪙50 |
| 2nd | 🪙125 |
| 3rd | 🪙313 |
| 4th | 🪙781 |
| … | ×2.5 each time |

---

## Town Square

The **Town tab** unlocks once you've reached a full 6×6 farm grid and upgraded your barn to Level 3. It's a late-game system for trading surplus crops and coins for **Affinity** with your neighbors.

### NPCs

| NPC | Personality |
|-----|-------------|
| 👴 Old Man Kalbi | Grumpy/Traditional |
| 🐕 Mayor Kimchi | A literal Dog / Ambitious |
| 👒 Lady Ellie | High Society / Elite |
| 👫 Mason & Jason | Chaotic Children |
| 🐱 Hunter Maru | Cat (w/ Crow) |
| 🌿 Herbalist Cinna | Medicinal/Calm |
| 🧙 Wizard Kola | Eccentric/Cosmic |

### How It Works

Each NPC generates one request at a time — either for a bulk crop delivery, a coin payment, or a combination of both. Fulfill the request to earn **+1 Affinity** with that neighbor. After delivery, the NPC rests for 1–10 minutes before posting a new request.

- **Crop requests:** 30–80 units of a single crop type
- **Coin requests:** 🪙3,000–🪙7,000
- **Combo requests:** both a crop and coins

A red **!** badge appears on the Town tab button when any NPC has an active request. Requirement pills on each card show how much you currently have versus how much is needed, and turn green when you're ready to deliver.

Cooldowns are timestamp-based and progress while the tab is closed.

---

## Header At a Glance

| Pill | Meaning |
|------|---------|
| 🪙 | Current coins |
| 🌱 | Total seeds in inventory (all types) |
| 🏚️ | Barn used / capacity |
| 💧 | Water in inventory (appears after first purchase) |
| 🌿 | Fertilizer in inventory (appears after first purchase) |
| 🧤 | Gloves durability remaining (only shown when equipped) |

---

## Achievements & Stats (Log Tab)

The **Log tab** tracks your progress across three sections.

**Achievements** — 16 total, hidden until earned:

| Achievement | Condition |
|-------------|-----------|
| 🌾 First Harvest | Harvest your first crop |
| 🧺 Busy Hands | Harvest 10 crops |
| 🏆 Century Farmer | Harvest 100 crops |
| 🪙 Pocket Change | Earn 100 coins lifetime |
| 💰 Golden Harvest | Earn 1,000 coins lifetime |
| 🤑 Truffle Tycoon | Earn 10,000 coins lifetime |
| ⛈️ Storm Survivor | Survive a thunderstorm |
| 🌊 Flood Survivor | Survive a flood |
| 🌧️ Free Water | Have plots watered by rain |
| 🏡 Full House | Fill every plot at once |
| 🧤 Green Thumb | Use gloves 20 times |
| 🍄 Truffle Hunter | Harvest your first Truffle |
| 🗺️ Land Baron | Reach a 4×4 farm or larger |
| 💀 Nature's Wrath | Lose 5+ crops to weather |
| 🏪 Market Regular | Sell crops 10 times |
| 💧 Diligent Farmer | Water 20 individual plots |

**Stats** — total harvests, lifetime coins, plots watered/fertilized, sell actions, crops lost to weather, truffles harvested, and gloves uses.

**Weather History** — a bar chart showing how often each weather type has occurred.

---

## Beg Button

If you run out of both seeds and coins, a **🙏 Beg for Seeds** button appears on the Farm tab. Tap it 10 times and a kind stranger will donate 1 wheat seed to get you back on your feet.

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
- Weather uses an hourly timestamp stored in state — persists across sessions
- NPC cooldowns use `Date.now()` timestamps — timers progress while the tab is closed
- Save migration runs on load to handle older save formats gracefully
- Fonts: [Silkscreen](https://fonts.google.com/specimen/Silkscreen) (logo & stat values) + [Nunito](https://fonts.google.com/specimen/Nunito) (all body text) via Google Fonts
- Vibration uses the [Web Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) — silently ignored on desktop
