// ── UI / DOM MODULE ───────────────────────────────────────
import {
  state, settings, saveState,
  CROPS, WEATHER_TYPES, WEATHER_DURATION_MS, ACHIEVEMENTS,
  WATER_COST, WATER_HOSE_COST, FERT_COST, BIG_FERT_COST,
  GLOVES_COST, GLOVES_USES,
  BARN_UPGRADES, MAX_ROWS, MAX_COLS,
  barnCap, totalBarnContents, expandCost, currentWeatherMultiplier, formatTime,
} from './state.js';
import {
  NPC_DATA, NPC_ORDER, CROP_EMOJI,
  isTownUnlocked, migrateNpcs, unlockedNpcIds, canFulfill,
} from './npcs.js';

// ── SHORTHAND ─────────────────────────────────────────────
export function el(id) { return document.getElementById(id); }

// ── TOAST ─────────────────────────────────────────────────
let toastTimer;
export function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── THEME ─────────────────────────────────────────────────
export function applyTheme() {
  document.documentElement.setAttribute('data-theme', settings.dark ? 'dark' : 'light');
}

// ── TABS ──────────────────────────────────────────────────
export function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el('tab-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'shop') updateShopUI();
  if (name === 'log')  renderLogTab();
  if (name === 'town') renderTownTab();
}

// ── FARM GRID ─────────────────────────────────────────────
export function renderGrid() {
  const grid = el('farm-grid');
  grid.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
  // Apply column-count class so CSS can apply 6-col overflow fixes
  grid.className = `farm-grid cols-${state.cols}`;

  const needed = state.rows * state.cols;
  while (grid.children.length < needed) {
    const div = document.createElement('div');
    div.className = 'plot';
    div.innerHTML = `
      <div class="plot-emoji"></div>
      <div class="plot-label"></div>
      <div class="plot-timer"></div>
      <div class="plot-progress"><div class="plot-progress-bar" style="width:0%"></div></div>
    `;
    grid.appendChild(div);
  }
  while (grid.children.length > needed) grid.removeChild(grid.lastChild);

  // Re-bind click handlers after DOM changes
  Array.from(grid.children).forEach((div, i) => {
    div.onclick = () => {
      // clickPlot is defined in main.js and attached to window for HTML onclick attrs;
      // here we dispatch a custom event instead to keep modules decoupled.
      div.dispatchEvent(new CustomEvent('plot-click', { bubbles: true, detail: { idx: i } }));
    };
  });

  el('grid-size-badge').textContent = `${state.rows} × ${state.cols}`;
  for (let i = 0; i < needed; i++) renderPlot(i);
}

export function renderPlot(idx) {
  const grid = el('farm-grid');
  const plotEl = grid.children[idx];
  if (!plotEl) return;
  const plot = state.plots[idx];

  const emoji = plotEl.querySelector('.plot-emoji');
  const label = plotEl.querySelector('.plot-label');
  const timer = plotEl.querySelector('.plot-timer');
  const bar   = plotEl.querySelector('.plot-progress-bar');

  let mods = plotEl.querySelector('.plot-mods');
  if (!mods) {
    mods = document.createElement('div');
    mods.className = 'plot-mods';
    plotEl.insertBefore(mods, plotEl.querySelector('.plot-progress'));
  }

  plotEl.className = 'plot ' + plot.state;

  if (plot.state === 'empty') {
    emoji.textContent = '🟫';
    label.textContent = 'Plant';
    timer.textContent = '';
    bar.style.width   = '0%';
    mods.textContent  = '';
  } else {
    const crop   = CROPS[plot.crop || 'wheat'];
    const growMs = plot.watered ? crop.growMs * 0.65 : crop.growMs;

    if (plot.state === 'planted') {
      emoji.textContent = crop.seedling;
      const weatherMult     = currentWeatherMultiplier();
      const elapsed         = Date.now() - plot.plantedAt;
      const effectiveGrowMs = growMs * weatherMult;
      const pct             = Math.min(100, (elapsed / effectiveGrowMs) * 100);
      bar.style.width   = pct + '%';
      label.textContent = crop.name;
      timer.textContent = '';
    } else if (plot.state === 'ready') {
      emoji.textContent = crop.emoji;
      label.textContent = 'Harvest!';
      timer.textContent = '';
      bar.style.width   = '100%';
    }

    const modIcons = [];
    if (plot.watered)    modIcons.push('💧');
    if (plot.fertilized) modIcons.push('🌿');
    mods.textContent = modIcons.join('');
  }
}

// ── HEADER ────────────────────────────────────────────────
export function updateHeader() {
  el('coin-display').textContent = state.coins;
  const seeds =
    (state.wheatSeeds   || 0) +
    (state.cornSeeds    || 0) +
    (state.pumpkinSeeds || 0) +
    (state.truffleSeeds || 0);
  el('seed-display').textContent = seeds;
  el('barn-display').textContent = `${totalBarnContents()}/${barnCap()}`;

  const showWater = state.stats.everBoughtWater || (state.water || 0) > 0;
  const showFert  = state.stats.everBoughtFert  || (state.fertilizer || 0) > 0;
  const gd        = state.glovesDurability || 0;
  const showRow2  = showWater || showFert || gd > 0;

  el('stats-row-2').style.display       = showRow2  ? 'flex' : 'none';
  el('water-pill').style.display        = showWater ? 'flex' : 'none';
  el('header-water-display').textContent = state.water || 0;
  el('fert-pill').style.display         = showFert  ? 'flex' : 'none';
  el('header-fert-display').textContent  = state.fertilizer || 0;
  el('gloves-pill').style.display       = gd > 0    ? 'flex' : 'none';
  el('gloves-display').textContent      = gd;
}

// ── FARM TOOLBAR ──────────────────────────────────────────
// selectedCrop / selectedTool are owned by main.js and passed in as args
export function updateFarmToolbar(selectedCrop, selectedTool) {
  const cornUnlocked    = (state.lifetimeCoins || 0) >= CROPS.corn.unlockCoins;
  const pumpkinUnlocked = (state.lifetimeCoins || 0) >= CROPS.pumpkin.unlockCoins;
  const truffleUnlocked = (state.lifetimeCoins || 0) >= CROPS.truffle.unlockCoins;
  const hasWater = (state.water || 0) > 0 || state.stats.everBoughtWater;
  const hasFert  = (state.fertilizer || 0) > 0 || state.stats.everBoughtFert;
  const showTools = hasWater || hasFert;

  const plantMode = selectedTool === 'plant';
  el('crop-btn-wheat').classList.toggle('selected',   plantMode && selectedCrop === 'wheat');
  el('crop-btn-corn').classList.toggle('selected',    plantMode && selectedCrop === 'corn');
  el('crop-btn-pumpkin').classList.toggle('selected', plantMode && selectedCrop === 'pumpkin');
  el('crop-btn-truffle').classList.toggle('selected', plantMode && selectedCrop === 'truffle');

  el('crop-btn-corn').disabled    = !cornUnlocked;
  el('crop-btn-pumpkin').disabled = !pumpkinUnlocked;
  el('crop-btn-truffle').disabled = !truffleUnlocked;

  el('toolbar-wheat-seeds').textContent   = `×${state.wheatSeeds || 0}`;
  el('toolbar-corn-seeds').textContent    = cornUnlocked    ? `×${state.cornSeeds    || 0}` : '🔒';
  el('toolbar-pumpkin-seeds').textContent = pumpkinUnlocked ? `×${state.pumpkinSeeds || 0}` : '🔒';
  el('toolbar-truffle-seeds').textContent = truffleUnlocked ? `×${state.truffleSeeds || 0}` : '🔒';

  el('tool-toolbar').style.display = showTools ? 'flex' : 'none';

  if (showTools) {
    const waterBtn = el('tool-btn-water');
    const fertBtn  = el('tool-btn-fert');

    waterBtn.style.display = hasWater ? 'flex' : 'none';
    fertBtn.style.display  = hasFert  ? 'flex' : 'none';

    waterBtn.className = 'tool-btn' + (selectedTool === 'water' ? ' active-water' : '');
    fertBtn.className  = 'tool-btn' + (selectedTool === 'fert'  ? ' active-fert'  : '');

    waterBtn.disabled = (state.water      || 0) === 0;
    fertBtn.disabled  = (state.fertilizer || 0) === 0;

    el('toolbar-water-count').textContent = `×${state.water      || 0}`;
    el('toolbar-fert-count').textContent  = `×${state.fertilizer || 0}`;
  }
}

// ── HINT TEXT ─────────────────────────────────────────────
export function updateHint() {
  const hint = el('farm-hint');
  if (!hint) return;
  // Hide once farm is maxed — no need to educate an expert
  if (state.rows >= MAX_ROWS && state.cols >= MAX_COLS) {
    hint.textContent = '';
    return;
  }
  const hasWater = state.stats.everBoughtWater || (state.water || 0) > 0;
  const hasFert  = state.stats.everBoughtFert  || (state.fertilizer || 0) > 0;
  hint.textContent = (hasWater || hasFert)
    ? 'Tap empty to plant · Select 💧 or 🌿 mode then tap a growing plot · Tap ready to harvest'
    : 'Tap an empty plot to plant · Wait for it to grow · Tap to harvest';
}

// ── BEG ZONE ──────────────────────────────────────────────
export function updateBegZone() {
  const totalSeeds = (state.wheatSeeds||0)+(state.cornSeeds||0)+(state.pumpkinSeeds||0)+(state.truffleSeeds||0);
  const broke = totalSeeds === 0 && state.coins === 0 && totalBarnContents() === 0;
  const zone  = el('beg-zone');
  if (!zone) return;
  zone.style.display = broke ? 'block' : 'none';
  if (!broke) {
    state.begTaps = 0;
    const prog = el('beg-progress');
    if (prog) prog.textContent = '';
  }
}

// ── SHOP UI ───────────────────────────────────────────────
export function updateShopUI() {
  const w        = state.wheat   || 0;
  const c        = state.corn    || 0;
  const pk       = state.pumpkin || 0;
  const tr       = state.truffle || 0;
  const barnUsed = totalBarnContents();
  const cap      = barnCap();

  const cornUnlocked    = (state.lifetimeCoins || 0) >= CROPS.corn.unlockCoins;
  const pumpkinUnlocked = (state.lifetimeCoins || 0) >= CROPS.pumpkin.unlockCoins;
  const truffleUnlocked = (state.lifetimeCoins || 0) >= CROPS.truffle.unlockCoins;
  const maxGridReached  = state.rows >= MAX_ROWS && state.cols >= MAX_COLS;
  const wheatHarvests   = state.stats.wheatHarvests || 0;
  const suppliesUnlocked =
    state.stats.everBoughtWater || state.stats.everBoughtFert ||
    (state.water || 0) > 0 || (state.fertilizer || 0) > 0 ||
    (state.lifetimeCoins || 0) >= 50;
  const growingPlots = state.plots.filter(p => p.state === 'planted');
  const totalStock   = w + c + pk + tr;

  // Sell all
  el('sell-all-crops-btn').disabled = totalStock === 0;

  // Wheat seeds (always visible)
  el('buy-wheat1-btn').disabled  = state.coins < CROPS.wheat.seedCost;
  el('buy-wheat10-btn').disabled = state.coins < CROPS.wheat.seedCost * 10;
  el('wheat-seed-count').textContent = `${state.wheatSeeds || 0} owned`;

  // Corn seeds
  el('corn-shop-card').style.display    = cornUnlocked ? 'flex' : 'none';
  el('corn-unlock-msg').style.display   = 'none';
  el('corn-shop-actions').style.display = 'flex';
  el('buy-corn1-btn').disabled = state.coins < CROPS.corn.seedCost;
  el('buy-corn5-btn').disabled = state.coins < CROPS.corn.seedCost * 5;
  el('corn-seed-count').textContent = `${state.cornSeeds || 0} owned`;

  // Pumpkin seeds
  el('pumpkin-shop-card').style.display    = pumpkinUnlocked ? 'flex' : 'none';
  el('pumpkin-unlock-msg').style.display   = 'none';
  el('pumpkin-shop-actions').style.display = 'flex';
  el('buy-pumpkin1-btn').disabled = state.coins < CROPS.pumpkin.seedCost;
  el('buy-pumpkin3-btn').disabled = state.coins < CROPS.pumpkin.seedCost * 3;
  el('pumpkin-seed-count').textContent = `${state.pumpkinSeeds || 0} owned`;

  // Truffle seeds
  el('truffle-shop-card').style.display    = truffleUnlocked ? 'flex' : 'none';
  el('truffle-unlock-msg').style.display   = 'none';
  el('truffle-shop-actions').style.display = 'flex';
  el('buy-truffle1-btn').disabled = state.coins < CROPS.truffle.seedCost;
  el('buy-truffle3-btn').disabled = state.coins < CROPS.truffle.seedCost * 3;
  el('truffle-seed-count').textContent = `${state.truffleSeeds || 0} owned`;

  // Supplies
  el('supplies-section-title').style.display = suppliesUnlocked ? 'block' : 'none';
  el('water-shop-card').style.display        = suppliesUnlocked ? 'flex'  : 'none';
  el('fert-shop-card').style.display         = suppliesUnlocked ? 'flex'  : 'none';

  el('buy-water1-btn').disabled = state.coins < WATER_COST;
  el('buy-water5-btn').disabled = state.coins < WATER_COST * 5;
  el('water-count').textContent = `${state.water || 0} owned`;

  el('hose-shop-card').style.display = maxGridReached ? 'flex' : 'none';
  el('buy-hose-btn').disabled = state.coins < WATER_HOSE_COST ||
    growingPlots.filter(p => !p.watered).length === 0;

  el('buy-fert1-btn').disabled = state.coins < FERT_COST;
  el('buy-fert5-btn').disabled = state.coins < FERT_COST * 5;
  el('fert-count').textContent = `${state.fertilizer || 0} owned`;

  el('bigfert-shop-card').style.display = maxGridReached ? 'flex' : 'none';
  el('buy-bigfert-btn').disabled = state.coins < BIG_FERT_COST ||
    growingPlots.filter(p => !p.fertilized).length === 0;

  // Gloves
  el('gloves-shop-card').style.display = wheatHarvests >= 20 ? 'flex' : 'none';
  const gd = state.glovesDurability || 0;
  el('buy-gloves-btn').disabled   = gd > 0 || state.coins < GLOVES_COST;
  el('gloves-status').textContent = gd > 0 ? `${gd}/${GLOVES_USES} uses left` : 'Not equipped';
  el('gloves-status').style.color = gd > 0 ? 'var(--accent2)' : 'var(--text3)';

  // Sell rows
  el('sell-wheat-all-btn').disabled   = w  === 0;
  el('sell-wheat1-btn').disabled      = w  === 0;
  el('wheat-barn-count').textContent  = `${w} in barn`;

  el('sell-corn-card').style.display   = cornUnlocked ? 'flex' : 'none';
  el('sell-corn-all-btn').disabled     = c  === 0;
  el('sell-corn1-btn').disabled        = c  === 0;
  el('corn-barn-count').textContent    = `${c} in barn`;

  el('sell-pumpkin-card').style.display   = pumpkinUnlocked ? 'flex' : 'none';
  el('sell-pumpkin-all-btn').disabled     = pk === 0;
  el('sell-pumpkin1-btn').disabled        = pk === 0;
  el('pumpkin-barn-count').textContent    = `${pk} in barn`;

  el('sell-truffle-card').style.display   = truffleUnlocked ? 'flex' : 'none';
  el('sell-truffle-all-btn').disabled     = tr === 0;
  el('sell-truffle1-btn').disabled        = tr === 0;
  el('truffle-barn-count').textContent    = `${tr} in barn`;

  // Barn
  el('barn-cap-display').textContent = `${barnUsed}/${cap}`;
  const nextLevel = (state.barnLevel || 0) + 1;
  if (nextLevel > BARN_UPGRADES.length) {
    el('barn-upgrade-btn').disabled     = true;
    el('barn-upgrade-btn').textContent  = 'Max';
    el('barn-upgrade-cost').textContent = 'Fully upgraded';
  } else {
    const upg = BARN_UPGRADES[nextLevel - 1];
    el('barn-upgrade-btn').disabled     = state.coins < upg.cost;
    el('barn-upgrade-btn').textContent  = 'Upgrade';
    el('barn-upgrade-cost').textContent = `🪙${upg.cost} → ${upg.cap} cap`;
  }

  // Expand farm section
  const rCost = expandCost('row');
  const cCost = expandCost('col');
  el('row-cost').textContent = `🪙 ${rCost}`;
  el('col-cost').textContent = `🪙 ${cCost}`;
  el('row-btn').disabled = state.coins < rCost || state.rows >= MAX_ROWS;
  el('col-btn').disabled = state.coins < cCost || state.cols >= MAX_COLS;
  el('row-desc').textContent = state.rows >= MAX_ROWS ? 'Max rows reached' : `${state.rows} → ${state.rows+1} rows`;
  el('col-desc').textContent = state.cols >= MAX_COLS ? 'Max cols reached' : `${state.cols} → ${state.cols+1} cols`;

  // Max-farm banner replaces expand cards at 6×6
  const maxFarmBanner = el('max-farm-banner');
  const expandCards   = el('expand-grid-cards');
  if (maxGridReached) {
    maxFarmBanner?.classList.add('visible');
    if (expandCards) expandCards.style.display = 'none';
  } else {
    maxFarmBanner?.classList.remove('visible');
    if (expandCards) expandCards.style.display = '';
  }
}

// ── WEATHER BANNER ────────────────────────────────────────
export function updateWeatherBanner() {
  if (!state.weather) return;
  const w      = WEATHER_TYPES[state.weather.current] || WEATHER_TYPES.clear;
  const banner = el('weather-banner');
  if (!banner) return;
  banner.className = 'weather-banner ' + (w.cls || '');
  el('weather-icon').textContent = w.icon;
  el('weather-name').textContent = w.name;
  el('weather-desc').textContent = w.desc;
  const remaining = Math.max(0, WEATHER_DURATION_MS - (Date.now() - state.weather.changedAt));
  const mins      = Math.ceil(remaining / 60000);
  el('weather-timer').textContent = mins > 0 ? `${mins}m left` : 'Changing...';
}

// ── TOWN VISIBILITY + BADGE ───────────────────────────────
export function updateTownVisibility() {
  const btn = el('town-tab-btn');
  if (btn) btn.style.display = isTownUnlocked() ? '' : 'none';
}

export function updateTownBadge() {
  if (!isTownUnlocked()) return;
  const badge = el('town-badge');
  if (!badge) return;
  migrateNpcs();
  const hasNew = unlockedNpcIds().some(id => state.npcs[id].request !== null);
  badge.style.display = hasNew ? '' : 'none';
}

// ── TOWN TAB ──────────────────────────────────────────────
export function renderTownTab() {
  const lockedEl  = el('town-locked-msg');
  const contentEl = el('town-content');
  const unlocked  = isTownUnlocked();

  if (!unlocked) {
    lockedEl.style.display  = '';
    contentEl.style.display = 'none';
    const gridMet = state.rows >= 6 && state.cols >= 6;
    const barnMet = state.barnLevel >= 3;
    el('lock-req-grid').className = 'lock-req' + (gridMet ? ' met' : '');
    el('lock-req-barn').className = 'lock-req' + (barnMet ? ' met' : '');
    return;
  }

  lockedEl.style.display  = 'none';
  contentEl.style.display = '';
  migrateNpcs();

  const list = el('npc-list');
  list.innerHTML = '';

  Object.entries(NPC_DATA)
    .filter(([id]) => unlockedNpcIds().includes(id))
    .forEach(([id, data]) => {
      const npc        = state.npcs[id];
      const req        = npc.request;
      const onCooldown = !req && Date.now() < npc.nextRequestAt;
      const fulfill    = req ? canFulfill(id) : false;

      const hearts = '♥'.repeat(Math.min(5, Math.floor(npc.affinity / 3)));
      const emptyH = '♡'.repeat(Math.max(0, 5 - Math.min(5, Math.floor(npc.affinity / 3))));

      let bodyHtml = '';
      if (req) {
        const pills = [];
        if (req.crop > 0) {
          const have = state[req.cropKey] || 0;
          const met  = have >= req.crop;
          pills.push(`<span class="req-pill ${met?'met':'unmet'}">${CROP_EMOJI[req.cropKey]} ${req.cropKey.charAt(0).toUpperCase()+req.cropKey.slice(1)}<span class="req-fraction">${have}/${req.crop}</span></span>`);
        }
        if (req.coins > 0) {
          const met = state.coins >= req.coins;
          pills.push(`<span class="req-pill ${met?'met':'unmet'}">🪙 Coins<span class="req-fraction">${state.coins.toLocaleString()}/${req.coins.toLocaleString()}</span></span>`);
        }
        bodyHtml = `
          <div class="npc-dialogue">"${req.text}"</div>
          <div class="npc-reqs">${pills.join('')}</div>
          <div class="npc-footer">
            <span></span>
            <button class="btn sm${fulfill?' gold':''}" data-deliver="${id}" ${fulfill?'':'disabled'}>
              ${fulfill ? '📦 Deliver!' : '📦 Deliver'}
            </button>
          </div>`;
      } else if (onCooldown) {
        const allNpcsUnlocked = (state.unlockedNpcs || []).length >= NPC_ORDER.length;
        if (allNpcsUnlocked) {
          bodyHtml = `<div class="npc-dialogue" style="font-style:normal;color:var(--text3);text-align:center;">💤 Resting… they'll be back soon!</div>`;
        } else {
          const secs = Math.max(0, Math.ceil((npc.nextRequestAt - Date.now()) / 1000));
          bodyHtml = `<div class="npc-dialogue" style="font-style:normal;color:var(--text3);text-align:center;">💤 Resting… next request in <span class="cooldown-msg" data-until="${npc.nextRequestAt}">${formatTime(secs)}</span></div>`;
        }
      } else {
        bodyHtml = `<div class="npc-dialogue" style="font-style:normal;color:var(--text3);text-align:center;">⏳ Preparing a request…</div>`;
      }

      const card = document.createElement('div');
      card.className = `npc-card${fulfill?' fulfillable':''}${onCooldown?' on-cooldown':''}`;
      card.innerHTML = `
        <div class="npc-header">
          <div class="npc-sprite">${data.sprite}</div>
          <div class="npc-info">
            <div class="npc-name">${data.name}</div>
            <div class="npc-role">${data.role}</div>
          </div>
          <div class="npc-affinity">
            <div class="affinity-label">Affinity</div>
            <div class="affinity-val">${npc.affinity}</div>
            <div class="affinity-hearts" style="color:var(--gold)">${hearts}<span style="color:var(--text3)">${emptyH}</span></div>
          </div>
        </div>
        ${bodyHtml}
      `;
      list.appendChild(card);
    });

  updateTownBadge();
}

/** Tick cooldown timers in-place without full re-render. */
export function tickTownCooldowns() {
  document.querySelectorAll('.cooldown-msg[data-until]').forEach(span => {
    const until = parseInt(span.dataset.until);
    const secs  = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    span.textContent = formatTime(secs);
  });
}

// ── LOG TAB ───────────────────────────────────────────────
export function renderLogTab() {
  renderAchievements();
  renderStats();
  renderWeatherHistory();
}

function renderAchievements() {
  const grid = el('achievement-grid');
  const prog = el('achievement-progress');
  if (!grid) return;
  const unlocked = state.unlockedAchievements || [];
  prog.textContent = `${unlocked.length}/${ACHIEVEMENTS.length}`;
  grid.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const isUnlocked = unlocked.includes(a.id);
    const card = document.createElement('div');
    card.className = 'achievement-card ' + (isUnlocked ? 'unlocked' : 'locked');
    card.innerHTML = `
      <div class="achievement-icon">${a.icon}</div>
      <div class="achievement-name">${a.name}</div>
      <div class="achievement-desc">${isUnlocked ? a.desc : '???'}</div>
      ${isUnlocked ? '<div class="achievement-badge">✓</div>' : ''}
    `;
    grid.appendChild(card);
  });
}

function renderStats() {
  const grid = el('stats-grid');
  if (!grid) return;
  const s = state.stats || {};
  const items = [
    { icon:'🌾', label:'Crops Harvested',       val: s.totalHarvests     || 0 },
    { icon:'🪙', label:'Lifetime Coins',         val: state.lifetimeCoins || 0 },
    { icon:'💧', label:'Plots Watered',          val: s.totalWatered      || 0 },
    { icon:'🌿', label:'Plots Fertilized',       val: s.totalFertilized   || 0 },
    { icon:'🏪', label:'Sell Actions',           val: s.sellActions       || 0 },
    { icon:'💀', label:'Crops Lost to Weather',  val: s.cropsLostToWeather|| 0 },
    { icon:'🍄', label:'Truffles Harvested',     val: s.truffleHarvests   || 0 },
    { icon:'🧤', label:'Gloves Uses',            val: s.glovesUses        || 0 },
  ];
  grid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-card-icon">${item.icon}</div>
      <div class="stat-card-val">${item.val.toLocaleString()}</div>
      <div class="stat-card-label">${item.label}</div>
    `;
    grid.appendChild(card);
  });
}

function renderWeatherHistory() {
  const list = el('weather-history-list');
  if (!list) return;
  const counts = (state.stats && state.stats.weatherCounts) || {};
  const total  = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    list.innerHTML = '<p class="empty-hint">No weather events recorded yet.</p>';
    return;
  }
  list.innerHTML = '';
  Object.values(WEATHER_TYPES).forEach(w => {
    const count = counts[w.id] || 0;
    if (count === 0) return;
    const pct = Math.round((count / total) * 100);
    const row = document.createElement('div');
    row.style.cssText = 'background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:10px;';
    row.innerHTML = `
      <span style="font-size:22px">${w.icon}</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:13px">${w.name}</div>
        <div style="height:6px;background:var(--bg3);border-radius:3px;margin-top:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px;transition:width 0.5s"></div>
        </div>
      </div>
      <div style="font-family:'Silkscreen',monospace;font-size:11px;color:var(--text2);text-align:right">
        <div>${count}×</div><div style="color:var(--text3)">${pct}%</div>
      </div>
    `;
    list.appendChild(row);
  });
}
