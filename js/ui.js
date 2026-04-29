// ── UI / DOM MODULE ───────────────────────────────────────
import {
  state, settings, saveState,
  CROPS, WEATHER_TYPES, WEATHER_DURATION_MS, ACHIEVEMENTS,
  WATER_COST, WATER_HOSE_COST, FERT_COST, BIG_FERT_COST,
  GLOVES_COST, GLOVES_USES,
  BARN_UPGRADES, MAX_ROWS, MAX_COLS,
  WATER_UNLOCK_COINS, FERT_UNLOCK_COINS,
  barnCap, totalBarnContents, expandCost, currentWeatherMultiplier, formatTime,
  computeGrowMs, computeEffectiveElapsed,
} from './state.js';
import {
  NPC_DATA, NPC_ORDER, CROP_EMOJI,
  isTownUnlocked, migrateNpcs, unlockedNpcIds, canFulfill,
  affinityLevel, bonusForLevel, activeBonusText, currentStoryText,
} from './npcs.js';

// Import all formulas from the centralized logic module
import {
  npcLevel,
  wheatSellPrice, cornSellPrice, pumpkinSellPrice, truffleSellPrice,
  waterSpeedupPct, hoseCost, waterSpeedupFactor,
  fertYieldAmt, bigFertCost, bigFertYieldAmt,
  glovesMaxUses, glovesChancePct,
  prideLevelFromPoints, goldenYieldPerk,
  computeGrowMs as logicGrowMs,
  computeEffectiveElapsed as logicElapsed,
} from './logic.js';

import {
  isEndgameActive, migrateBanquet, potProgress, isPotFull,
  permitCost, currentPotRequirements, currentParty,
  HARVEST_RUSH_START_LEN, HARVEST_RUSH_MAX_LEN, HARVEST_RUSH_TIMER_MS,
  BANQUET_SCHEDULE,
} from './banquet.js';

// ── SHORTHAND ─────────────────────────────────────────────
export function el(id) { return document.getElementById(id); }

// ── FARM INFO BAR ─────────────────────────────────────────
let farmInfoToastActive = false;
let farmInfoToastTimer  = null;

function setFarmInfoBar(msg, isToast) {
  const bar  = el('farm-info-bar');
  const text = el('farm-info-text');
  if (!bar || !text) return;
  text.textContent = msg;
  if (isToast) {
    bar.classList.add('farm-info-toast');
    bar.classList.remove('farm-info-idle');
  } else {
    bar.classList.add('farm-info-idle');
    bar.classList.remove('farm-info-toast');
  }
}

function clearFarmInfoToast() {
  farmInfoToastActive = false;
  clearTimeout(farmInfoToastTimer);
  farmInfoToastTimer = null;
  updateFarmInfoBar();
}

function nextHarvestText() {
  const weatherMult  = currentWeatherMultiplier();
  const curWeather   = (state.weather && state.weather.current) || 'clear';
  const isBadWeather = ['rain', 'thunder', 'flood'].includes(curWeather);

  const eff            = state.merchant && state.merchant.effect;
  const isFrozen       = !!(eff && eff.id === 'frozen' && eff.frozenAt && (!eff.expiresAt || Date.now() < eff.expiresAt));
  const frozenNow      = isFrozen ? eff.frozenAt : undefined;
  const photosynthActive = !!(eff && eff.id === 'photosynth' && (!eff.expiresAt || Date.now() < eff.expiresAt));
  const waterSpeed     = waterSpeedupFactor(); // divisor < 1, e.g. 0.65

  let minRemainingMs = Infinity; // real wall-clock ms

  state.plots.forEach(plot => {
    if (plot.state !== 'planted') return;
    const cropKey = plot.crop || 'wheat';

    const truffleGrowMult = npcLevel('ellie') >= 4 ? 0.80 : npcLevel('ellie') >= 2 ? 0.90 : 1.0;
    const cornGrowMult    = npcLevel('twins') >= 5 ? 0.50 : 1.0;
    const pumpkinWM       = npcLevel('maru')  >= 4 ? 0.70 : 1.0;
    const kalbiL5         = npcLevel('kalbi') >= 5;

    const growMs          = computeGrowMs(cropKey, weatherMult, isBadWeather, {
      truffleGrowMult, cornGrowMult, pumpkinWeatherMult: pumpkinWM, kalbiL5, photosynthActive,
    });

    // computeEffectiveElapsed returns how much of growMs has been "consumed" in effective time
    const effectiveElapsed = computeEffectiveElapsed(plot, waterSpeed, frozenNow);
    const remainEffectiveMs = Math.max(0, growMs - effectiveElapsed);

    // Convert effective remaining time back to real wall-clock time for display.
    // Unwatered: 1:1.  Watered: real_remaining = effective_remaining × speedup_divisor.
    let remainRealMs;
    if (isFrozen) {
      remainRealMs = remainEffectiveMs; // timer is paused, show frozen remainder as-is
    } else if (plot.watered && plot.wateredAt) {
      remainRealMs = remainEffectiveMs * waterSpeed;
    } else {
      remainRealMs = remainEffectiveMs;
    }

    if (remainRealMs < minRemainingMs) minRemainingMs = remainRealMs;
  });

  if (minRemainingMs === Infinity) return '';
  if (minRemainingMs <= 0)         return '🌾 Ready to harvest!';

  const totalSecs = Math.ceil(minRemainingMs / 1000);
  const mins      = Math.floor(totalSecs / 60);
  const secs      = totalSecs % 60;
  const timeStr   = mins > 0 ? `${mins}m${secs > 0 ? ' ' + secs + 's' : ''}` : `${secs}s`;
  return `⏱ ${timeStr} until next harvest`;
}

export function updateFarmInfoBar() {
  if (farmInfoToastActive) return;
  const merchant = state.merchant;
  const eff      = merchant && merchant.effect;
  const now      = Date.now();
  if (eff && eff.id && (!eff.expiresAt || now < eff.expiresAt)) {
    let timeStr = '';
    if (eff.usesLeft !== undefined) {
      timeStr = `${eff.usesLeft} use${eff.usesLeft !== 1 ? 's' : ''} left`;
    } else if (eff.expiresAt) {
      const secsLeft = Math.max(0, Math.ceil((eff.expiresAt - now) / 1000));
      const h  = Math.floor(secsLeft / 3600);
      const m2 = Math.floor((secsLeft % 3600) / 60);
      const s  = secsLeft % 60;
      if (h > 0)       timeStr = `${h}h ${m2}m`;
      else if (m2 > 0) timeStr = `${m2}m ${s}s`;
      else             timeStr = `${s}s`;
    }
    setFarmInfoBar(`${eff.icon} ${eff.label}${timeStr ? ' · ' + timeStr : ''}`, false);
    return;
  }
  const harvest = nextHarvestText();
  setFarmInfoBar(harvest, false);
}

// ── TOAST ─────────────────────────────────────────────────
let toastTimer;

export function toast(msg) {
  const farmPanel = el('tab-farm');
  const onFarm    = farmPanel && farmPanel.classList.contains('active');

  if (onFarm) {
    farmInfoToastActive = true;
    clearTimeout(farmInfoToastTimer);
    setFarmInfoBar(msg, true);
    farmInfoToastTimer = setTimeout(() => { clearFarmInfoToast(); }, 8000);
  }

  const t = el('toast');
  t.textContent = msg;
  t.style.pointerEvents = 'auto';
  t.style.cursor = 'pointer';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    t.style.pointerEvents = 'none';
    t.style.cursor = 'default';
  }, 8000);
}

export function dismissToast() {
  const t = el('toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.classList.remove('show');
  t.style.pointerEvents = 'none';
  t.style.cursor = 'default';
  if (farmInfoToastActive) clearFarmInfoToast();
}

function initToastDismiss() {
  const t = el('toast');
  if (!t) return;
  t.style.pointerEvents = 'none';
  t.addEventListener('click', () => {
    clearTimeout(toastTimer);
    t.classList.remove('show');
    t.style.pointerEvents = 'none';
    t.style.cursor = 'default';
  });
  const bar = el('farm-info-bar');
  if (bar) {
    bar.addEventListener('click', () => {
      if (farmInfoToastActive) clearFarmInfoToast();
    });
  }
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToastDismiss);
  } else {
    initToastDismiss();
  }
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
  if (name === 'shop')     updateShopUI();
  if (name === 'log')      renderLogTab();
  if (name === 'town')     renderTownTab();
  if (name === 'settings') renderBodieBook();
}

// ── BODIE UI ──────────────────────────────────────────────
export function updateBodieUI() {
  import('./bodie.js').then(({ isBodieUnread, getBodieQueueLength }) => {
    const btn   = el('bodie-btn');
    const label = el('bodie-label');
    if (!btn) return;
    const unread = isBodieUnread();
    btn.classList.toggle('bodie-unread',  unread);
    btn.classList.toggle('bodie-read',   !unread);
    if (label) {
      const count = getBodieQueueLength ? getBodieQueueLength() : 0;
      if (unread && count > 1) {
        label.textContent = `${count} tips`;
        label.classList.add('visible');
      } else {
        label.textContent = '';
        label.classList.remove('visible');
      }
    }
  });
}

// ── BOOK OF BARNS ─────────────────────────────────────────
const BOOK_PREVIEW_COUNT = 3;
let bodieBookExpanded = false;

export function renderBodieBook() {
  const list = el('bodie-book-list');
  if (!list) return;

  import('./bodie.js').then(({ getCollectedTips }) => {
    const entries = getCollectedTips();
    list.innerHTML = '';

    if (entries.length === 0) {
      list.innerHTML = '<div style="padding:14px 16px;font-size:12px;color:var(--text3);font-style:italic;text-align:center">No entries yet. Tap 🐾 Bodie to collect tips!</div>';
      bodieBookExpanded = false;
      return;
    }

    const countRow = document.createElement('div');
    countRow.style.cssText = 'padding:10px 16px 6px;font-size:11px;color:var(--text3);font-weight:700;letter-spacing:0.05em;text-transform:uppercase;border-bottom:1px solid var(--border)';
    countRow.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} collected`;
    list.appendChild(countRow);

    const visible = bodieBookExpanded ? entries : entries.slice(0, BOOK_PREVIEW_COUNT);

    visible.forEach((entry, idx) => {
      const isLast = idx === visible.length - 1 && (bodieBookExpanded || entries.length <= BOOK_PREVIEW_COUNT);
      const row  = document.createElement('div');
      row.style.cssText = `display:flex;align-items:flex-start;gap:12px;padding:12px 16px;${isLast ? '' : 'border-bottom:1px solid var(--border)'}`;

      const iconEl = document.createElement('div');
      iconEl.style.cssText = 'font-size:18px;flex-shrink:0;margin-top:1px;line-height:1';
      iconEl.textContent = entry.icon || '🐾';

      const body = document.createElement('div');
      body.style.cssText = 'flex:1;min-width:0';

      const text = document.createElement('div');
      text.style.cssText = 'font-size:12px;color:var(--text);line-height:1.5';
      text.textContent = entry.text;

      const meta = document.createElement('div');
      meta.style.cssText = 'font-size:10px;color:var(--text3);margin-top:3px;font-family:"Silkscreen",monospace;font-weight:400';
      meta.textContent = formatEntryDate(entry.timestamp);

      body.appendChild(text);
      body.appendChild(meta);
      row.appendChild(iconEl);
      row.appendChild(body);
      list.appendChild(row);
    });

    if (entries.length > BOOK_PREVIEW_COUNT) {
      const toggleRow = document.createElement('div');
      toggleRow.style.cssText = 'border-top:1px solid var(--border);padding:10px 16px;text-align:center';
      const toggleBtn = document.createElement('button');
      toggleBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;font-weight:700;color:var(--accent2);font-family:"Nunito",sans-serif;padding:0';
      const hidden = entries.length - BOOK_PREVIEW_COUNT;
      toggleBtn.textContent = bodieBookExpanded ? 'Show less ▲' : `Show ${hidden} more ▼`;
      toggleBtn.addEventListener('click', () => {
        bodieBookExpanded = !bodieBookExpanded;
        renderBodieBook();
      });
      toggleRow.appendChild(toggleBtn);
      list.appendChild(toggleRow);
    }
  });
}

function formatEntryDate(ts) {
  if (!ts) return '';
  const d   = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── FARM GRID ─────────────────────────────────────────────
export function renderGrid() {
  const grid = el('farm-grid');
  grid.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
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

  Array.from(grid.children).forEach((div, i) => {
    div.onclick = () => {
      div.dispatchEvent(new CustomEvent('plot-click', { bubbles: true, detail: { idx: i } }));
    };
  });

  for (let i = 0; i < needed; i++) renderPlot(i);
}

export function renderPlot(idx) {
  const grid   = el('farm-grid');
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

  if (plot.state === 'flooded') {
    emoji.textContent = '🌊';
    label.textContent = 'Flooded';
    timer.textContent = '';
    bar.style.width   = '0%';
    mods.textContent  = '';
  } else if (plot.state === 'empty') {
    emoji.textContent = '🟫';
    label.textContent = 'Plant';
    timer.textContent = '';
    bar.style.width   = '0%';
    mods.textContent  = '';
  } else {
    const crop = CROPS[plot.crop || 'wheat'];

    if (plot.state === 'planted') {
      emoji.textContent = crop.seedling;
      const cropKey      = plot.crop || 'wheat';
      const weatherMult  = currentWeatherMultiplier();
      const curWeather   = (state.weather && state.weather.current) || 'clear';
      const isBadWeather = ['rain', 'thunder', 'flood'].includes(curWeather);
      const eff          = state.merchant && state.merchant.effect;
      const photosynthOn = !!(eff && eff.id === 'photosynth' && (!eff.expiresAt || Date.now() < eff.expiresAt));
      const effectiveGrowMs = computeGrowMs(cropKey, weatherMult, isBadWeather, {
        truffleGrowMult:    npcLevel('ellie') >= 4 ? 0.80 : npcLevel('ellie') >= 2 ? 0.90 : 1.0,
        cornGrowMult:       npcLevel('twins') >= 5 ? 0.50 : 1.0,
        pumpkinWeatherMult: npcLevel('maru')  >= 4 ? 0.70 : 1.0,
        kalbiL5:            npcLevel('kalbi') >= 5,
        photosynthActive:   photosynthOn,
      });
      const waterSpeed  = waterSpeedupFactor();
      const frozenEff   = state.merchant && state.merchant.effect;
      const frozenNowOv = (frozenEff && frozenEff.id === 'frozen' && frozenEff.frozenAt &&
        (!frozenEff.expiresAt || Date.now() < frozenEff.expiresAt))
        ? frozenEff.frozenAt : undefined;
      const effectiveElapsed = computeEffectiveElapsed(plot, waterSpeed, frozenNowOv);
      const pct = Math.min(100, (effectiveElapsed / effectiveGrowMs) * 100);
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

  const lifetime  = state.lifetimeCoins || 0;
  const showWater = lifetime >= WATER_UNLOCK_COINS || state.stats.everBoughtWater || (state.water || 0) > 0;
  const showFert  = lifetime >= FERT_UNLOCK_COINS  || state.stats.everBoughtFert  || (state.fertilizer || 0) > 0;
  const gd        = state.glovesDurability || 0;
  const showRow2  = showWater || showFert || gd > 0;

  el('stats-row-2').style.display        = showRow2  ? 'flex' : 'none';
  el('water-pill').style.display         = showWater ? 'flex' : 'none';
  el('header-water-display').textContent = state.water || 0;
  el('fert-pill').style.display          = showFert  ? 'flex' : 'none';
  el('header-fert-display').textContent  = state.fertilizer || 0;
  el('gloves-pill').style.display        = gd > 0    ? 'flex' : 'none';
  // Show ∞ symbol when Kimchi Lv.5 Golden Mitts is active (glovesMaxUses returns Infinity)
  el('gloves-display').textContent       = glovesMaxUses() === Infinity ? '∞' : gd;
}

// ── FARM TOOLBAR ──────────────────────────────────────────
export function updateFarmToolbar(selectedCrop, selectedTool) {
  const lifetime        = state.lifetimeCoins || 0;
  const cornUnlocked    = lifetime >= CROPS.corn.unlockCoins;
  const pumpkinUnlocked = lifetime >= CROPS.pumpkin.unlockCoins;
  const truffleUnlocked = lifetime >= CROPS.truffle.unlockCoins;
  const showWater = lifetime >= WATER_UNLOCK_COINS || (state.water || 0) > 0 || state.stats.everBoughtWater;
  const showFert  = lifetime >= FERT_UNLOCK_COINS  || (state.fertilizer || 0) > 0 || state.stats.everBoughtFert;
  const showTools = showWater || showFert;
  const plantMode = selectedTool === 'plant';

  el('crop-btn-wheat').style.display = '';
  el('crop-btn-wheat').classList.toggle('selected', plantMode && selectedCrop === 'wheat');
  el('toolbar-wheat-seeds').textContent = `×${state.wheatSeeds || 0}`;

  el('crop-btn-corn').style.display = cornUnlocked ? '' : 'none';
  if (cornUnlocked) {
    el('crop-btn-corn').classList.toggle('selected', plantMode && selectedCrop === 'corn');
    el('toolbar-corn-seeds').textContent = `×${state.cornSeeds || 0}`;
  }

  el('crop-btn-pumpkin').style.display = pumpkinUnlocked ? '' : 'none';
  if (pumpkinUnlocked) {
    el('crop-btn-pumpkin').classList.toggle('selected', plantMode && selectedCrop === 'pumpkin');
    el('toolbar-pumpkin-seeds').textContent = `×${state.pumpkinSeeds || 0}`;
  }

  el('crop-btn-truffle').style.display = truffleUnlocked ? '' : 'none';
  if (truffleUnlocked) {
    el('crop-btn-truffle').classList.toggle('selected', plantMode && selectedCrop === 'truffle');
    el('toolbar-truffle-seeds').textContent = `×${state.truffleSeeds || 0}`;
  }

  el('tool-toolbar').style.display = showTools ? 'flex' : 'none';

  if (showTools) {
    const waterBtn = el('tool-btn-water');
    const fertBtn  = el('tool-btn-fert');

    waterBtn.style.display = showWater ? 'flex' : 'none';
    fertBtn.style.display  = showFert  ? 'flex' : 'none';

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
  if (state.rows >= MAX_ROWS && state.cols >= MAX_COLS) { hint.textContent = ''; return; }
  const lifetime = state.lifetimeCoins || 0;
  const hasWater = lifetime >= WATER_UNLOCK_COINS || state.stats.everBoughtWater || (state.water || 0) > 0;
  const hasFert  = lifetime >= FERT_UNLOCK_COINS  || state.stats.everBoughtFert  || (state.fertilizer || 0) > 0;
  hint.textContent = (hasWater || hasFert)
    ? 'Tap empty to plant · Select 💧 or 🌿 mode then tap a growing plot · Tap ready to harvest'
    : 'Tap an empty plot to plant · Wait for it to grow · Tap to harvest';
}

// ── BEG ZONE ──────────────────────────────────────────────
export function updateBegZone() {
  const totalSeeds = (state.wheatSeeds||0)+(state.cornSeeds||0)+(state.pumpkinSeeds||0)+(state.truffleSeeds||0);
  const broke      = totalSeeds === 0 && totalBarnContents() === 0 && state.coins < CROPS.wheat.seedCost;
  const zone       = el('beg-zone');
  if (!zone) return;
  zone.style.display = broke ? 'block' : 'none';
  if (!broke) {
    if (state.begTaps !== 0) { state.begTaps = 0; saveState(); }
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
  const lifetime = state.lifetimeCoins || 0;

  const cornUnlocked    = lifetime >= CROPS.corn.unlockCoins;
  const pumpkinUnlocked = lifetime >= CROPS.pumpkin.unlockCoins;
  const truffleUnlocked = lifetime >= CROPS.truffle.unlockCoins;
  const maxRowsReached  = state.rows >= MAX_ROWS;
  const maxColsReached  = state.cols >= MAX_COLS;
  const maxGridReached  = maxRowsReached && maxColsReached;
  const wheatHarvests   = state.stats.wheatHarvests || 0;

  const waterUnlocked    = lifetime >= WATER_UNLOCK_COINS || state.stats.everBoughtWater || (state.water || 0) > 0;
  const fertUnlocked     = lifetime >= FERT_UNLOCK_COINS  || state.stats.everBoughtFert  || (state.fertilizer || 0) > 0;
  const suppliesUnlocked = waterUnlocked || fertUnlocked;

  const growingPlots = state.plots.filter(p => p.state === 'planted');
  const totalStock   = w + c + pk + tr;

  el('sell-all-crops-btn').disabled = totalStock === 0;

  el('buy-wheat1-btn').disabled  = state.coins < CROPS.wheat.seedCost;
  el('buy-wheat10-btn').disabled = state.coins < CROPS.wheat.seedCost * 10;
  el('wheat-seed-count').textContent = `${state.wheatSeeds || 0} owned`;

  el('corn-shop-card').style.display    = cornUnlocked ? 'flex' : 'none';
  el('corn-unlock-msg').style.display   = 'none';
  el('corn-shop-actions').style.display = 'flex';
  el('buy-corn1-btn').disabled = state.coins < CROPS.corn.seedCost;
  el('buy-corn5-btn').disabled = state.coins < CROPS.corn.seedCost * 5;
  el('corn-seed-count').textContent = `${state.cornSeeds || 0} owned`;

  el('pumpkin-shop-card').style.display    = pumpkinUnlocked ? 'flex' : 'none';
  el('pumpkin-unlock-msg').style.display   = 'none';
  el('pumpkin-shop-actions').style.display = 'flex';
  el('buy-pumpkin1-btn').disabled = state.coins < CROPS.pumpkin.seedCost;
  el('buy-pumpkin3-btn').disabled = state.coins < CROPS.pumpkin.seedCost * 3;
  el('pumpkin-seed-count').textContent = `${state.pumpkinSeeds || 0} owned`;

  el('truffle-shop-card').style.display    = truffleUnlocked ? 'flex' : 'none';
  el('truffle-unlock-msg').style.display   = 'none';
  el('truffle-shop-actions').style.display = 'flex';
  el('buy-truffle1-btn').disabled = state.coins < CROPS.truffle.seedCost;
  el('buy-truffle3-btn').disabled = state.coins < CROPS.truffle.seedCost * 3;
  el('truffle-seed-count').textContent = `${state.truffleSeeds || 0} owned`;

  el('supplies-section-title').style.display = suppliesUnlocked ? 'block' : 'none';
  el('water-shop-card').style.display        = waterUnlocked ? 'flex'  : 'none';
  el('fert-shop-card').style.display         = fertUnlocked  ? 'flex'  : 'none';

  el('buy-water1-btn').disabled = state.coins < WATER_COST;
  el('buy-water5-btn').disabled = state.coins < WATER_COST * 5;
  el('water-count').textContent = `${state.water || 0} owned`;

  el('hose-shop-card').style.display = maxRowsReached ? 'flex' : 'none';
  el('buy-hose-btn').disabled = state.coins < hoseCost() ||
    growingPlots.filter(p => !p.watered).length === 0;

  el('buy-fert1-btn').disabled = state.coins < FERT_COST;
  el('buy-fert5-btn').disabled = state.coins < FERT_COST * 5;
  el('fert-count').textContent = `${state.fertilizer || 0} owned`;

  el('bigfert-shop-card').style.display = maxColsReached ? 'flex' : 'none';
  el('buy-bigfert-btn').disabled = state.coins < bigFertCost() ||
    growingPlots.filter(p => !p.fertilized).length === 0;

  el('gloves-shop-card').style.display = wheatHarvests >= 20 ? 'flex' : 'none';
  const gd = state.glovesDurability || 0;
  el('buy-gloves-btn').disabled   = gd > 0 || state.coins < GLOVES_COST;
  const maxUses = glovesMaxUses();
  const usesLabel = maxUses === Infinity ? '∞ uses (Golden Mitts!)' : `${gd}/${maxUses} uses left`;
  el('gloves-status').textContent = gd > 0 ? usesLabel : 'Not equipped';
  el('gloves-status').style.color = gd > 0 ? 'var(--accent2)' : 'var(--text3)';

  const wPrice  = wheatSellPrice();
  const cPrice  = cornSellPrice();
  const pkPrice = pumpkinSellPrice();
  const trPrice = truffleSellPrice();
  const _elf = el;
  _elf('wheat-sell-desc')   && (_elf('wheat-sell-desc').textContent   = `${wPrice}🪙 each`);
  _elf('corn-sell-desc')    && (_elf('corn-sell-desc').textContent    = `${cPrice}🪙 each`);
  _elf('pumpkin-sell-desc') && (_elf('pumpkin-sell-desc').textContent = `${pkPrice}🪙 each`);
  _elf('truffle-sell-desc') && (_elf('truffle-sell-desc').textContent = npcLevel('ellie')>=5 ? `${trPrice}🪙 (Royal Purveyor 2.2×!)` : `${trPrice}🪙 each`);
  _elf('wheat-sell-price')  && (_elf('wheat-sell-price').textContent   = `🪙${wPrice}`);
  _elf('corn-sell-price')   && (_elf('corn-sell-price').textContent    = `🪙${cPrice}`);
  _elf('pumpkin-sell-price')&& (_elf('pumpkin-sell-price').textContent = `🪙${pkPrice}`);
  _elf('truffle-sell-price')&& (_elf('truffle-sell-price').textContent = `🪙${trPrice}`);

  _elf('wheat-seed-desc')   && (_elf('wheat-seed-desc').textContent   = `Grows in 2 min · Sells for ${wPrice}🪙`);
  _elf('corn-seed-desc')    && (_elf('corn-seed-desc').textContent    = `Grows in 8 min · Sells for ${cPrice}🪙`);
  _elf('pumpkin-seed-desc') && (_elf('pumpkin-seed-desc').textContent = `Grows in 15 min · Sells for ${pkPrice}🪙`);
  _elf('truffle-seed-desc') && (_elf('truffle-seed-desc').textContent = `Grows in 45 min · Sells for ${trPrice}🪙`);

  const hCost = hoseCost();
  const wPct  = waterSpeedupPct();
  _elf('hose-cost-tag') && (_elf('hose-cost-tag').textContent = hCost === 0 ? 'FREE!' : `🪙${hCost}`);
  _elf('hose-desc')     && (_elf('hose-desc').textContent     = `Waters all growing plots · ${wPct}% faster each`);
  _elf('water-desc')    && (_elf('water-desc').textContent    = `Apply to one growing plot · ${wPct}% faster grow`);

  const fYield  = fertYieldAmt();
  const bfCost  = bigFertCost();
  const bfYield = bigFertYieldAmt();
  _elf('fert-desc')        && (_elf('fert-desc').textContent    = `Apply to one growing plot · +${fYield} yield on harvest`);
  _elf('bigfert-cost-tag') && (_elf('bigfert-cost-tag').textContent = bfCost === 0 ? 'FREE!' : `🪙${bfCost}`);
  _elf('bigfert-desc')     && (_elf('bigfert-desc').textContent  = `Fertilizes all growing plots · +${bfYield} yield each`);

  const gChance  = glovesChancePct();
  const gMax     = glovesMaxUses();
  const gUsesStr = gMax === Infinity ? 'unlimited uses' : `${gMax} uses`;
  _elf('gloves-desc') && (_elf('gloves-desc').textContent = `${gChance}% seed recovery on harvest · ${gUsesStr}`);

  el('sell-wheat-all-btn').disabled   = w  === 0;
  el('sell-wheat1-btn').disabled      = w  === 0;
  el('wheat-barn-count').textContent  = `${w} in barn`;

  el('sell-corn-card').style.display   = cornUnlocked ? 'flex' : 'none';
  el('sell-corn-all-btn').disabled     = c  === 0;
  el('sell-corn1-btn').disabled        = c  === 0;
  el('corn-barn-count').textContent    = `${c} in barn`;

  el('sell-pumpkin-card').style.display  = pumpkinUnlocked ? 'flex' : 'none';
  el('sell-pumpkin-all-btn').disabled    = pk === 0;
  el('sell-pumpkin1-btn').disabled       = pk === 0;
  el('pumpkin-barn-count').textContent   = `${pk} in barn`;

  el('sell-truffle-card').style.display  = truffleUnlocked ? 'flex' : 'none';
  el('sell-truffle-all-btn').disabled    = tr === 0;
  el('sell-truffle1-btn').disabled       = tr === 0;
  el('truffle-barn-count').textContent   = `${tr} in barn`;

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

  const rCost = expandCost('row');
  const cCost = expandCost('col');
  el('row-cost').textContent = `🪙 ${rCost}`;
  el('col-cost').textContent = `🪙 ${cCost}`;
  el('row-btn').disabled = state.coins < rCost || state.rows >= MAX_ROWS;
  el('col-btn').disabled = state.coins < cCost || state.cols >= MAX_COLS;
  el('row-desc').textContent = state.rows >= MAX_ROWS ? 'Max rows reached' : `${state.rows} → ${state.rows+1} rows`;
  el('col-desc').textContent = state.cols >= MAX_COLS ? 'Max cols reached' : `${state.cols} → ${state.cols+1} cols`;

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
  const now       = Date.now();
  const remaining = Math.max(0, WEATHER_DURATION_MS - (now - state.weather.changedAt));
  const mins      = Math.ceil(remaining / 60000);
  const cur       = state.weather.current;

  let timerText = mins > 0 ? `${mins}m left` : 'Changing...';
  if (cur === 'rain' && state.weather.lastRainAt) {
    const nextRain = Math.max(0, Math.ceil((5 * 60 * 1000 - (now - state.weather.lastRainAt)) / 1000));
    if (nextRain > 0) timerText += ` · next water ${nextRain >= 60 ? Math.ceil(nextRain/60)+'m' : nextRain+'s'}`;
  }
  if (cur === 'thunder' && state.weather.lastThunderAt) {
    const nextZap = Math.max(0, Math.ceil((5 * 60 * 1000 - (now - state.weather.lastThunderAt)) / 1000));
    if (nextZap > 0) timerText += ` · next zap ${nextZap >= 60 ? Math.ceil(nextZap/60)+'m' : nextZap+'s'}`;
  }
  if (cur === 'flood' && state.weather.floodedRow >= 0) {
    timerText += ` · row ${state.weather.floodedRow + 1} flooded`;
  }

  el('weather-timer').textContent = timerText;
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

// ── TOWN TAB — MAIN ROUTER ────────────────────────────────
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
  migrateBanquet();

  // Route to the right renderer
  if (isEndgameActive()) {
    renderGrandBanquetSection();
  } else {
    renderNpcCards();
  }

  updateTownBadge();
}

// ── TOWN PRIDE HEADER ─────────────────────────────────────
function renderPrideHeader() {
  const pts     = state.pridePoints || 0;
  const level   = prideLevelFromPoints(pts);
  const perkRow = [
    'No perk yet',
    '5% → +5 crops on harvest',
    '5% → +10 crops on harvest',
    '10% → +10 crops on harvest',
    '25% → +10 crops on harvest',
    '25% → +10 crops + Instant Grow 25% on plant ✨',
  ];
  const ptsInLevel = pts % 3;
  const barPct = level >= 5 ? 100 : Math.round((ptsInLevel / 3) * 100);

  return `
    <div class="pride-header">
      <div class="pride-title-row">
        <span class="pride-icon">🌟</span>
        <span class="pride-title">Town Pride</span>
        <span class="pride-level-badge ${level >= 5 ? 'pride-max' : ''}">Lv.${level}</span>
        <span class="pride-pts">${pts} pt${pts !== 1 ? 's' : ''}</span>
      </div>
      <div class="affinity-bar-track" style="margin:6px 0 4px"><div class="affinity-bar-fill" style="width:${barPct}%"></div></div>
      <div class="pride-perk">${level >= 5 ? '✨' : '🎯'} Golden Yield: ${perkRow[level]}</div>
    </div>
  `;
}

// ── NPC CARDS ─────────────────────────────────────────────
function renderNpcCards() {
  const list = el('npc-list');
  list.innerHTML = '';

  // Pride header always shows once town is open
  const prideDiv = document.createElement('div');
  prideDiv.innerHTML = renderPrideHeader();
  list.appendChild(prideDiv.firstElementChild);

  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'section-title';
  sectionTitle.style.marginTop = '16px';
  sectionTitle.textContent = '🏘️ Town Square';
  list.appendChild(sectionTitle);

  const subText = document.createElement('p');
  subText.style.cssText = 'font-size:12px;color:var(--text2);margin-bottom:14px';
  subText.textContent = 'Your neighbors need things. Help them out to earn Affinity!';
  list.appendChild(subText);

  Object.entries(NPC_DATA)
    .filter(([id]) => unlockedNpcIds().includes(id))
    .forEach(([id, data]) => {
      list.appendChild(buildNpcCard(id, data));
    });

  list.querySelectorAll('[data-toggle-npc]').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('[data-deliver]')) return;
      const npcId = header.dataset.toggleNpc;
      import('./npcs.js').then(({ toggleNpcExpanded }) => toggleNpcExpanded(npcId));
    });
  });
}

function buildNpcCard(id, data) {
  const npc        = state.npcs[id];
  const req        = npc.request;
  const onCooldown = !req && Date.now() < npc.nextRequestAt;
  const fulfill    = req ? canFulfill(id) : false;
  const maxed      = npc.affinity >= 15;
  const lvl        = affinityLevel(id);

  const hearts  = '♥'.repeat(lvl);
  const emptyH  = '♡'.repeat(Math.max(0, 5 - lvl));
  const nextAt  = lvl < 5 ? (lvl * 3) + 3 : 15;
  const progPct = lvl >= 5 ? 100 : Math.round((npc.affinity / nextAt) * 100);

  const activeBonus = activeBonusText(id);
  const story       = currentStoryText(id);

  const bonusPips = data.bonuses.map((b, i) => {
    const bLvl    = i + 1;
    const reached = lvl >= bLvl;
    const isCur   = lvl === bLvl;
    const pipText = reached ? b : '???';
    return `<div class="affinity-bonus-pip ${reached ? 'reached' : ''} ${isCur ? 'current' : ''}">
      <span class="pip-level">Lv.${bLvl}</span>
      <span class="pip-text">${pipText}</span>
    </div>`;
  }).join('');

  const expandedPanel = npc.expanded ? `
    <div class="npc-affinity-panel">
      ${story ? `<div class="npc-story-text">"${story}"</div>` : ''}
      <div class="affinity-bonus-list">${bonusPips}</div>
    </div>` : '';

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
    const capstoneTag = req.isCapstone ? `<span class="capstone-tag">⭐ FINAL</span>` : '';
    bodyHtml = `
      <div class="npc-dialogue">${capstoneTag}"${req.text}"</div>
      <div class="npc-reqs">${pills.join('')}</div>
      <div class="npc-footer">
        <span></span>
        <button class="btn sm${fulfill?' gold':''}" data-deliver="${id}" ${fulfill?'':'disabled'}>
          ${fulfill ? '📦 Deliver!' : '📦 Deliver'}
        </button>
      </div>`;
  } else if (maxed) {
    bodyHtml = `<div class="npc-dialogue maxed-msg">✨ Max Affinity reached! ${activeBonus}</div>`;
  } else if (onCooldown) {
    const allNpcsUnlocked = (state.unlockedNpcs || []).length >= NPC_ORDER.length;
    if (allNpcsUnlocked) {
      bodyHtml = `<div class="npc-dialogue" style="font-style:normal;color:var(--text3);text-align:center;">💤 Resting… they'll be back soon!</div>`;
    } else {
      const secs = Math.max(0, Math.ceil((npc.nextRequestAt - Date.now()) / 1000));
      bodyHtml = `<div class="npc-dialogue" style="font-style:normal;color:var(--text3);text-align:center;">💤 Resting… next in <span class="cooldown-msg" data-until="${npc.nextRequestAt}">${formatTime(secs)}</span></div>`;
    }
  } else {
    bodyHtml = `<div class="npc-dialogue" style="font-style:normal;color:var(--text3);text-align:center;">⏳ Preparing a request…</div>`;
  }

  const card = document.createElement('div');
  card.className = `npc-card${fulfill?' fulfillable':''}${onCooldown?' on-cooldown':''}${maxed?' maxed':''}`;
  card.innerHTML = `
    <div class="npc-header" data-toggle-npc="${id}" style="cursor:pointer">
      <div class="npc-sprite">${data.sprite}</div>
      <div class="npc-info">
        <div class="npc-name">${data.name}${lvl > 0 ? ` <span class="affinity-level-badge lv${lvl === 5 ? '-max' : ''}">Lv.${lvl}</span>` : ''}</div>
        <div class="npc-role">${data.role}</div>
        <div class="affinity-bar-wrap">
          <div class="affinity-bar-track"><div class="affinity-bar-fill" style="width:${progPct}%"></div></div>
          <div class="affinity-hearts-row"><span style="color:var(--gold)">${hearts}</span><span style="color:var(--text3)">${emptyH}</span><span class="affinity-pts-label">${npc.affinity}/15</span></div>
        </div>
      </div>
      <div class="npc-expand-chevron">${npc.expanded ? '▲' : '▼'}</div>
    </div>
    ${expandedPanel}
    ${bodyHtml}
  `;
  return card;
}

// ── GRAND BANQUET SECTION ─────────────────────────────────
function renderGrandBanquetSection() {
  const list = el('npc-list');
  list.innerHTML = '';

  // Pride header
  const prideDiv = document.createElement('div');
  prideDiv.innerHTML = renderPrideHeader();
  list.appendChild(prideDiv.firstElementChild);

  const b = state.banquet;

  // Banquet phase card
  switch (b.phase) {
    case 'idle':
      list.appendChild(renderBanquetIdle());
      break;
    case 'pot':
      list.appendChild(renderCommunalPot());
      break;
    case 'rush':
      list.appendChild(renderHarvestRush());
      break;
    case 'complete':
      list.appendChild(renderBanquetIdle());
      break;
    default:
      list.appendChild(renderBanquetIdle());
  }

  // ── Maxed NPC roster ──────────────────────────────────
  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'section-title';
  sectionTitle.style.marginTop = '20px';
  sectionTitle.textContent = '🏘️ Your Neighbors';
  list.appendChild(sectionTitle);

  const subText = document.createElement('p');
  subText.style.cssText = 'font-size:12px;color:var(--text2);margin-bottom:14px';
  subText.textContent = 'All neighbors are at max affinity. Tap any card to review their perks and story.';
  list.appendChild(subText);

  Object.entries(NPC_DATA).forEach(([id, data]) => {
    list.appendChild(buildNpcCard(id, data));
  });

  // Wire expand/collapse for NPC headers in this view
  list.querySelectorAll('[data-toggle-npc]').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('[data-deliver]')) return;
      const npcId = header.dataset.toggleNpc;
      import('./npcs.js').then(({ toggleNpcExpanded }) => toggleNpcExpanded(npcId));
    });
  });
}

function renderBanquetIdle() {
  const cost    = permitCost();
  const canBuy  = state.coins >= cost;
  const runs    = state.banquet?.completedRuns || 0;
  const party   = currentParty();
  const partyNum = (runs % BANQUET_SCHEDULE.length) + 1;

  // Resolve host display name — may be NPC or merchant
  const MERCHANT_HOST_NAMES = { mochi: 'Mochi ☀️', moto: 'Moto 🌙' };
  const hostDisplay = MERCHANT_HOST_NAMES[party.hostId]
    ?? (NPC_DATA[party.hostId]?.name || party.hostId);

  // Pot requirements for this run
  const reqs = currentPotRequirements();
  const reqStr = reqs.map(r => `${r.qty} ${({wheat:'🌾',corn:'🌽',pumpkin:'🎃',truffle:'🍄'})[r.cropKey]}`).join(' · ');

  const div = document.createElement('div');
  div.className = 'npc-card maxed';
  div.style.marginTop = '16px';
  div.innerHTML = `
    <div style="text-align:center;padding:8px 0 12px">
      <div style="font-size:40px;margin-bottom:4px">${party.emoji}</div>
      <div style="font-size:10px;font-family:'Silkscreen',monospace;color:var(--text3);margin-bottom:4px;letter-spacing:0.06em">PARTY ${partyNum} OF ${BANQUET_SCHEDULE.length}</div>
      <div style="font-weight:800;font-size:16px;color:var(--accent2);margin-bottom:4px">${party.name}</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
        ${party.season} · Hosted by <strong style="color:var(--text2)">${hostDisplay}</strong>
      </div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;font-style:italic;background:var(--bg3);border-radius:10px;padding:8px 12px;margin-bottom:12px">
        "${party.desc}"
      </div>
      ${runs > 0 ? `<div style="font-size:11px;color:var(--gold);margin-bottom:10px">🎉 Banquets hosted: ${runs}</div>` : ''}
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px;font-weight:700">🍲 Communal Pot</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:12px">${reqStr}</div>
      <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:10px">
        📜 Town Permit: <span style="color:${canBuy ? 'var(--gold)' : 'var(--red)'}">🪙${cost.toLocaleString()}</span>
        <span style="font-size:11px;color:var(--text3);margin-left:4px">(${state.coins.toLocaleString()} owned)</span>
      </div>
      <button class="btn gold" data-buy-permit="1" style="width:100%;max-width:240px" ${canBuy ? '' : 'disabled'}>
        📜 Purchase Town Permit
      </button>
    </div>
  `;
  return div;
}

function renderCommunalPot() {
  const progress = potProgress();
  const party    = currentParty();
  const MERCHANT_HOST_NAMES = { mochi: 'Mochi ☀️', moto: 'Moto 🌙' };
  const hostDisplay = MERCHANT_HOST_NAMES[party.hostId]
    ?? (NPC_DATA[party.hostId]?.name || party.hostId);

  const div = document.createElement('div');
  div.className = 'npc-card';
  div.style.marginTop = '16px';

  const pillsHtml = progress.map(p => {
    const pct = Math.min(100, Math.round((p.delivered / p.required) * 100));
    const met = p.delivered >= p.required;
    const have = state[p.cropKey] || 0;
    return `
      <div class="pot-crop-row" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:700;font-size:13px">${p.emoji} ${p.cropKey.charAt(0).toUpperCase()+p.cropKey.slice(1)}</span>
          <span style="font-size:12px;color:${met?'var(--accent2)':'var(--text2)'}">${p.delivered}/${p.required} ${met?'✓':''}</span>
        </div>
        <div class="affinity-bar-track"><div class="affinity-bar-fill" style="width:${pct}%;background:${met?'var(--accent)':'var(--gold)'}"></div></div>
        <div style="text-align:right;font-size:11px;color:var(--text3);margin-top:3px">${have} in barn</div>
        ${!met ? `<button class="btn sm" data-pot-deliver="${p.cropKey}" style="margin-top:6px;width:100%" ${have>0?'':'disabled'}>
          Deliver ${p.emoji} (${Math.min(have, p.required - p.delivered)} of ${p.required - p.delivered} needed)
        </button>` : ''}
      </div>
    `;
  }).join('');

  div.innerHTML = `
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:28px">${party.emoji}</div>
      <div style="font-weight:800;font-size:15px;color:var(--accent2)">${party.name}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">Hosted by ${hostDisplay} · Fill the Communal Pot!</div>
    </div>
    ${pillsHtml}
  `;
  return div;
}

// ── HARVEST RUSH RENDERER ─────────────────────────────────
function renderHarvestRush() {
  const r = state.banquet?.rush;
  if (!r) return document.createElement('div');

  // ── Fail-pending screen ───────────────────────────────
  if (r.failPending) {
    return renderHarvestRushFail(r);
  }

  // Resolve host — may be NPC or merchant
  const MERCHANT_HOST_DATA = {
    mochi: { sprite: '☀️', name: 'Mochi' },
    moto:  { sprite: '🌙', name: 'Moto'  },
  };
  const host = NPC_DATA[r.hostId] ?? MERCHANT_HOST_DATA[r.hostId] ?? { sprite: '🎉', name: 'Host' };
  const party = currentParty();

  const now     = Date.now();
  const elapsed = now - r.startedAt;
  const timerRemaining = Math.max(0, Math.ceil((r.timerMs - elapsed) / 1000));
  const timerPct       = Math.max(0, ((r.timerMs - elapsed) / r.timerMs) * 100);

  const stage      = r.stage;
  const maxStage   = HARVEST_RUSH_MAX_LEN - HARVEST_RUSH_START_LEN + 1;
  const patternLen = HARVEST_RUSH_START_LEN - 1 + stage;
  const inputLen   = r.playerInput.length;
  const pattern    = r.pattern;

  const CROP_EMOJI_MAP = { wheat: '🌾', corn: '🌽', pumpkin: '🎃', truffle: '🍄' };

  // Pattern display: show what's been entered and what remains
  const patternHtml = pattern.map((ck, i) => {
    const isEntered = i < inputLen;
    const isCurrent = i === inputLen;
    return `<span style="
      font-size:clamp(18px,5vw,28px);
      padding:3px;
      opacity:${isEntered ? '0.35' : '1'};
      filter:${isCurrent ? 'drop-shadow(0 0 8px var(--gold))' : 'none'};
      transform:${isCurrent ? 'scale(1.2)' : 'scale(1)'};
      display:inline-block;
      transition:all 0.15s;
    ">${CROP_EMOJI_MAP[ck]}</span>`;
  }).join('');

  // Stage progress pips
  const stagePips = Array.from({ length: maxStage }, (_, i) => {
    const done = i < stage - 1;
    const cur  = i === stage - 1;
    return `<span style="font-size:12px;color:${done?'var(--accent2)':cur?'var(--gold)':'var(--text3)'}">${done?'●':cur?'◉':'○'}</span>`;
  }).join(' ');

  const mins       = Math.floor(timerRemaining / 60);
  const secs       = timerRemaining % 60;
  const timerStr   = `${mins > 0 ? mins + 'm ' : ''}${secs}s`;
  const timerColor = timerRemaining < 20 ? 'var(--red)' : timerRemaining < 60 ? 'var(--gold)' : 'var(--accent2)';

  const div = document.createElement('div');
  div.className = 'npc-card';
  div.style.marginTop = '16px';
  div.innerHTML = `
    <div style="text-align:center;margin-bottom:10px">
      <div style="font-size:28px">${host.sprite}</div>
      <div style="font-weight:800;font-size:15px;color:var(--accent2)">${party.name}</div>
      <div style="font-size:11px;color:var(--text3)">${host.name} is hosting the Harvest Rush!</div>
    </div>

    <!-- Timer — IDs used by tickRushTimer() for live updates -->
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;color:var(--text3)">⏱ Time remaining</span>
        <span id="rush-timer-text" style="font-family:'Silkscreen',monospace;font-size:13px;color:${timerColor}">${timerStr}</span>
      </div>
      <div class="affinity-bar-track">
        <div id="rush-timer-bar" class="affinity-bar-fill" style="width:${timerPct}%;background:${timerColor};transition:width 1s linear"></div>
      </div>
    </div>

    <!-- Stage progress -->
    <div style="text-align:center;margin-bottom:10px;font-size:12px;color:var(--text3)">
      Stage ${stage}/${maxStage} &nbsp; ${stagePips}
    </div>

    <!-- Pattern display -->
    <div style="background:var(--bg2);border-radius:12px;padding:12px 8px;text-align:center;margin-bottom:12px;letter-spacing:2px;min-height:56px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:2px">
      ${patternHtml}
    </div>

    <div style="font-size:11px;color:var(--text3);text-align:center;margin-bottom:10px">
      Tap to match: <strong>${inputLen}/${patternLen}</strong> correct
    </div>

    <!-- Tap buttons -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn" data-rush-crop="wheat"   style="font-size:20px;padding:14px 8px">🌾<br><span style="font-size:10px">Wheat</span></button>
      <button class="btn" data-rush-crop="corn"    style="font-size:20px;padding:14px 8px">🌽<br><span style="font-size:10px">Corn</span></button>
      <button class="btn" data-rush-crop="pumpkin" style="font-size:20px;padding:14px 8px">🎃<br><span style="font-size:10px">Pumpkin</span></button>
      <button class="btn" data-rush-crop="truffle" style="font-size:20px;padding:14px 8px">🍄<br><span style="font-size:10px">Truffle</span></button>
    </div>
  `;
  return div;
}

/**
 * Renders the failure screen shown after a wrong tap or timer expiry.
 * The pattern is shown with the expected crop highlighted in green.
 * Four crop buttons are replaced by a Bodie message + "Got it!" button.
 */
function renderHarvestRushFail(r) {
  const CROP_EMOJI_MAP = { wheat: '🌾', corn: '🌽', pumpkin: '🎃', truffle: '🍄' };
  const failure = r.lastFailure || {};
  const expectedCrop = failure.expectedCrop;
  const isExpired    = failure.reason === 'expired';
  const inputLen     = r.playerInput.length;
  const pattern      = r.pattern;

  // Pattern with expected crop highlighted green, wrong tap highlighted red
  const patternHtml = pattern.map((ck, i) => {
    const isExpectedPos = i === inputLen - 1 || (isExpired && i === inputLen);
    const isExpectedCrop = ck === expectedCrop && i === (isExpired ? inputLen : inputLen - 1);
    let bg = 'transparent';
    let border = 'none';
    if (isExpectedCrop) {
      // Highlight the correct crop they needed to tap — green
      bg = 'rgba(139,195,74,0.25)';
      border = '2px solid var(--accent)';
    }
    return `<span style="
      font-size:clamp(18px,5vw,28px);
      padding:4px 6px;
      display:inline-block;
      border-radius:8px;
      background:${bg};
      border:${border};
      transition:all 0.15s;
    ">${CROP_EMOJI_MAP[ck]}</span>`;
  }).join('');

  const failTitle  = isExpired ? '⏰ Time\'s Up!' : '❌ Wrong Ingredient!';
  const failColor  = 'var(--red)';
  const bodieMsg   = isExpired
    ? 'Hi! Im Bodie. Uh oh — time ran out! The highlighted ingredient is what was needed next. You\'ll have to refill the Communal Pot and try again...'
    : 'Hi! Im Bodie. Uh oh. The wrong ingredient went in. See the highlighted one? That\'s what was needed. You\'ll have to start over...';

  const div = document.createElement('div');
  div.className = 'npc-card';
  div.style.marginTop = '16px';
  div.innerHTML = `
    <!-- Frozen timer bar at 0 -->
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;color:var(--text3)">⏱ Time remaining</span>
        <span style="font-family:'Silkscreen',monospace;font-size:13px;color:var(--red)">0s</span>
      </div>
      <div class="affinity-bar-track">
        <div class="affinity-bar-fill" style="width:0%;background:var(--red)"></div>
      </div>
    </div>

    <!-- Failure title -->
    <div style="text-align:center;margin-bottom:10px">
      <div style="font-size:22px;font-weight:800;color:${failColor}">${failTitle}</div>
    </div>

    <!-- Pattern with highlighted expected crop -->
    <div style="background:var(--bg2);border-radius:12px;padding:12px 8px;text-align:center;margin-bottom:12px;min-height:56px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px">
      ${patternHtml}
    </div>

    <!-- Bodie failure message -->
    <div style="display:flex;align-items:flex-start;gap:10px;background:var(--bg3);border-radius:12px;padding:12px 14px;margin-bottom:14px;border:1.5px solid var(--border)">
      <span style="font-size:22px;flex-shrink:0;transform:scaleX(-1);display:block">🐾</span>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;font-style:italic">"${bodieMsg}"</div>
    </div>

    <!-- Got it button -->
    <button class="btn gold" data-rush-acknowledge="1" style="width:100%">Got it! Re-fill the Pot</button>
  `;
  return div;
}

// ── LOG TAB ───────────────────────────────────────────────
export function renderLogTab() {
  renderStats();
  renderWeatherHistory();
  renderAchievements();
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
    { icon:'🌾', label:'Crops Harvested',            val: s.totalHarvests     || 0 },
    { icon:'🪙', label:'Lifetime Coins',              val: state.lifetimeCoins || 0 },
    { icon:'🌾', label:'Wheat Harvested',             val: s.wheatHarvests     || 0 },
    { icon:'🌽', label:'Corn Harvested',              val: s.cornHarvests      || 0 },
    { icon:'🎃', label:'Pumpkins Harvested',          val: s.pumpkinHarvests   || 0 },
    { icon:'🍄', label:'Truffles Harvested',          val: s.truffleHarvests   || 0 },
    { icon:'💧', label:'Manually Watered',            val: s.totalWatered      || 0 },
    { icon:'🌿', label:'Manually Fertilized',         val: s.totalFertilized   || 0 },
    { icon:'🏪', label:'Sell Actions',                val: s.sellActions       || 0 },
    { icon:'💀', label:'Crops Lost to Weather',       val: s.cropsLostToWeather|| 0 },
    { icon:'🧤', label:'Gloves Uses',                 val: s.glovesUses        || 0 },
    { icon:'🙏', label:'Times Begged',                val: s.timesBegged       || 0 },
    { icon:'🎊', label:'Banquets Hosted',             val: state.banquet?.completedRuns || 0 },
    { icon:'🌟', label:'Town Pride Points',           val: state.pridePoints   || 0 },
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
      <div style="font-family:'Silkscreen',monospace;font-weight:400;font-size:11px;color:var(--text2);text-align:right">
        <div>${count}×</div><div style="color:var(--text3)">${pct}%</div>
      </div>
    `;
    list.appendChild(row);
  });
}

// ── MERCHANT UI ───────────────────────────────────────────
export function updateMerchantUI() {
  import('./merchants.js').then(M => {
    const m    = state.merchant;
    const sun  = el('merchant-mochi');
    const moon = el('merchant-moto');
    if (!sun || !moon) return;

    sun.style.display  = (m.active === 'mochi') ? 'flex' : 'none';
    moon.style.display = (m.active === 'moto')  ? 'flex' : 'none';

    updateFarmInfoBar();

    const outModal = el('moto-outcome-modal');
    if (outModal) {
      if (m.motoOutcome) {
        const o = m.motoOutcome;
        el('moto-outcome-icon').textContent  = o.icon;
        el('moto-outcome-label').textContent = o.label;
        el('moto-outcome-label').style.color = o.isGood ? 'var(--accent2)' : 'var(--red)';
        el('moto-outcome-desc').textContent  = o.desc;
        const flavor = el('moto-outcome-flavor');
        if (flavor) { flavor.textContent = o.flavor || ''; }
        outModal.classList.add('open');
      } else {
        outModal.classList.remove('open');
      }
    }
  });
}

export function tickMerchantBadge() {
  updateFarmInfoBar();
}

export function tickTownCooldowns() {
  document.querySelectorAll('.cooldown-msg[data-until]').forEach(span => {
    const until = parseInt(span.dataset.until);
    const secs  = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    span.textContent = formatTime(secs);
  });
}

export function openMerchantModal(who) {
  import('./merchants.js').then(M => {
    const modal = el('merchant-modal');
    if (!modal) return;
    const m = state.merchant;
    if (m.active !== who) return;

    const cost      = who === 'mochi' ? M.mochiCostForDisplay() : M.motoCostForDisplay();
    const canAfford = state.coins >= cost;

    el('merchant-modal-icon').textContent  = who === 'mochi' ? '☀️' : '🌙';
    el('merchant-modal-name').textContent  = who === 'mochi' ? 'Mochi' : 'Moto';
    el('merchant-modal-cost').textContent  = `🪙${cost.toLocaleString()}`;
    el('merchant-modal-cost').style.color  = canAfford ? 'var(--gold2)' : 'var(--red)';

    const greeting = who === 'mochi'
      ? 'The sun is at its zenith! Would you like to stabilize your yields today?'
      : "Mochi's scrolls are so… boring. Want to see what happens when you mix Truffle spores with moonbeams?";
    el('merchant-modal-greeting').textContent = greeting;

    const itemsEl = el('merchant-modal-items');
    itemsEl.innerHTML = '';

    if (who === 'mochi') {
      const item = M.MOCHI_ITEMS.find(i => i.id === m.activeItemId);
      if (item) {
        const row = document.createElement('div');
        row.className = 'merchant-item-row';
        row.innerHTML = `
          <span class="merchant-item-icon">${item.icon}</span>
          <div class="merchant-item-info">
            <div class="merchant-item-name">${item.name}</div>
            <div class="merchant-item-desc">${item.desc}</div>
          </div>
          <button class="btn sm${canAfford ? ' gold' : ''}" data-buy-mochi="${item.id}" ${canAfford ? '' : 'disabled'}>Buy</button>
        `;
        itemsEl.appendChild(row);
      }
    } else {
      const riddle = M.MOTO_RIDDLES.find(r => r.id === m.activeRiddleId);
      if (riddle) {
        const row = document.createElement('div');
        row.className = 'merchant-item-row merchant-riddle-row';
        row.innerHTML = `
          <span class="merchant-item-icon">🎲</span>
          <div class="merchant-item-info">
            <div class="merchant-item-name">${riddle.riddle}</div>
            <div class="merchant-item-desc" style="color:var(--text3);margin-top:4px;font-style:italic">Something will happen. Could be wonderful. Could be terrible.</div>
          </div>
          <button class="btn sm" data-buy-moto="${riddle.id}" ${canAfford ? '' : 'disabled'}>Roll the dice</button>
        `;
        itemsEl.appendChild(row);
      }
    }

    const declineBtn = el('merchant-decline-btn');
    if (declineBtn) {
      declineBtn.textContent = who === 'mochi' ? "Not today. Send Moto." : "Too risky. Send Mochi.";
    }

    modal.dataset.who = who;
    modal.classList.add('open');

    itemsEl.querySelectorAll('[data-buy-mochi]').forEach(btn => {
      btn.addEventListener('click', () => { M.buyMochiItem(btn.dataset.buyMochi); modal.classList.remove('open'); });
    });
    itemsEl.querySelectorAll('[data-buy-moto]').forEach(btn => {
      btn.addEventListener('click', () => { M.buyMotoRiddle(btn.dataset.buyMoto); modal.classList.remove('open'); });
    });
  });
}
