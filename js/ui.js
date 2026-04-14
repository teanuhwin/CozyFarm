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

// ── LOCAL AFFINITY HELPER (avoids circular import) ────────
function npcLevel(id) {
  return Math.min(5, Math.floor(((state.npcs && state.npcs[id] && state.npcs[id].affinity) || 0) / 3));
}
function wheatSellPrice()   { const l=npcLevel('kalbi');   return l>=3?13:l>=1?11:10; }
function cornSellPrice()    { const l=npcLevel('twins');   return l>=3?52:l>=1?46:40; }
function pumpkinSellPrice() { const l=npcLevel('maru');    return l>=3?112:l>=1?92:80; }
function truffleSellPrice() { const l=npcLevel('ellie');   return l>=5?Math.round(220*2.20):l>=3?275:l>=1?242:220; }
function waterSpeedupPct()  { const l=npcLevel('cinna');   return l>=5?70:l>=3?60:l>=1?45:35; }
function hoseCost()         { const l=npcLevel('cinna');   return l>=2?140:200; }
function fertYieldAmt()     { const l=npcLevel('kola');    return l>=3?5:l>=1?3:2; }
function bigFertCost()      { const l=npcLevel('kola');    return l>=2?190:280; }
function bigFertYieldAmt()  { const l=npcLevel('kola'); return l>=3?5:l>=1?3:2; }
function glovesMaxUses()    { const l=npcLevel('kimchi');  return l>=5?Infinity:l>=4?60:l>=3?50:l>=2?40:l>=1?30:20; }
function glovesChancePct()  { return npcLevel('kimchi')>=5?80:60; }


// ── SHORTHAND ─────────────────────────────────────────────
export function el(id) { return document.getElementById(id); }

// ── TOAST ─────────────────────────────────────────────────
let toastTimer;
export function toast(msg) {
  const t = el('toast');
  const badge = el('grid-size-badge');
  t.textContent = msg;
  t.classList.add('show');
  if (badge) badge.style.visibility = 'hidden';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    if (badge) badge.style.visibility = '';
  }, 3000);
}

// Wire up tap-to-dismiss on toast (done once at module load)
function initToastDismiss() {
  const t = el('toast');
  if (!t) return;
  t.style.pointerEvents = 'auto';
  t.style.cursor = 'pointer';
  t.addEventListener('click', () => {
    clearTimeout(toastTimer);
    t.classList.remove('show');
    const badge = el('grid-size-badge');
    if (badge) badge.style.visibility = '';
  });
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
  import('./bodie.js').then(({ isBodieUnread }) => {
    const btn = el('bodie-btn');
    if (!btn) return;
    const unread = isBodieUnread();
    btn.classList.toggle('bodie-unread', unread);
    btn.classList.toggle('bodie-read',  !unread);
  });
}

// ── BOOK OF BARNS ─────────────────────────────────────────
export function renderBodieBook() {
  const list = el('bodie-book-list');
  if (!list) return;

  import('./bodie.js').then(({ getCollectedTips }) => {
    const entries = getCollectedTips(); // newest first
    list.innerHTML = '';

    if (entries.length === 0) {
      list.innerHTML = '<div style="padding:14px 16px;font-size:12px;color:var(--text3);font-style:italic;text-align:center">No entries yet. Tap 🐾 Bodie to collect tips!</div>';
      return;
    }

    // Count label
    const countRow = document.createElement('div');
    countRow.style.cssText = 'padding:10px 16px 6px;font-size:11px;color:var(--text3);font-weight:700;letter-spacing:0.05em;text-transform:uppercase;border-bottom:1px solid var(--border)';
    countRow.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} collected`;
    list.appendChild(countRow);

    entries.forEach((entry, idx) => {
      const row = document.createElement('div');
      const isLast = idx === entries.length - 1;
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
      meta.style.cssText = 'font-size:10px;color:var(--text3);margin-top:3px;font-family:"Silkscreen",monospace';
      meta.textContent = formatEntryDate(entry.timestamp);

      body.appendChild(text);
      body.appendChild(meta);
      row.appendChild(iconEl);
      row.appendChild(body);
      list.appendChild(row);
    });
  });
}

function formatEntryDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
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
      const cropKey        = plot.crop || 'wheat';
      const weatherMult    = currentWeatherMultiplier();
      const curWeather     = (state.weather && state.weather.current) || 'clear';
      const isBadWeather   = ['rain', 'thunder', 'flood'].includes(curWeather);
      const eff            = state.merchant && state.merchant.effect;
      const photosynthOn   = !!(eff && eff.id === 'photosynth' && (!eff.expiresAt || Date.now() < eff.expiresAt));
      const effectiveGrowMs = computeGrowMs(cropKey, weatherMult, isBadWeather, {
        truffleGrowMult:    npcLevel('ellie') >= 4 ? 0.80 : npcLevel('ellie') >= 2 ? 0.90 : 1.0,
        cornGrowMult:       npcLevel('twins') >= 5 ? 0.50 : 1.0,
        pumpkinWeatherMult: npcLevel('maru')  >= 4 ? 0.70 : 1.0,
        kalbiL5:            npcLevel('kalbi') >= 5,
        photosynthActive:   photosynthOn,
      });
      const cinnaLvl   = npcLevel('cinna');
      const waterSpeed = cinnaLvl >= 5 ? 0.30 : cinnaLvl >= 3 ? 0.40 : cinnaLvl >= 1 ? 0.55 : 0.65;
      const effectiveElapsed = computeEffectiveElapsed(plot, waterSpeed);
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

  const lifetime = state.lifetimeCoins || 0;
  const showWater = lifetime >= WATER_UNLOCK_COINS || state.stats.everBoughtWater || (state.water || 0) > 0;
  const showFert  = lifetime >= FERT_UNLOCK_COINS  || state.stats.everBoughtFert  || (state.fertilizer || 0) > 0;
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
  if (state.rows >= MAX_ROWS && state.cols >= MAX_COLS) {
    hint.textContent = '';
    return;
  }
  const lifetime  = state.lifetimeCoins || 0;
  const hasWater = lifetime >= WATER_UNLOCK_COINS || state.stats.everBoughtWater || (state.water || 0) > 0;
  const hasFert  = lifetime >= FERT_UNLOCK_COINS  || state.stats.everBoughtFert  || (state.fertilizer || 0) > 0;
  hint.textContent = (hasWater || hasFert)
    ? 'Tap empty to plant · Select 💧 or 🌿 mode then tap a growing plot · Tap ready to harvest'
    : 'Tap an empty plot to plant · Wait for it to grow · Tap to harvest';
}

// ── BEG ZONE ──────────────────────────────────────────────
export function updateBegZone() {
  const totalSeeds = (state.wheatSeeds||0)+(state.cornSeeds||0)+(state.pumpkinSeeds||0)+(state.truffleSeeds||0);
  const broke = totalSeeds === 0 && totalBarnContents() === 0 && state.coins < CROPS.wheat.seedCost;
  const zone  = el('beg-zone');
  if (!zone) return;
  zone.style.display = broke ? 'block' : 'none';
  if (!broke) {
    if (state.begTaps !== 0) {
      state.begTaps = 0;
      saveState();
    }
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

  const waterUnlocked = lifetime >= WATER_UNLOCK_COINS || state.stats.everBoughtWater || (state.water || 0) > 0;
  const fertUnlocked  = lifetime >= FERT_UNLOCK_COINS  || state.stats.everBoughtFert  || (state.fertilizer || 0) > 0;
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
  _elf('wheat-sell-desc')  && (_elf('wheat-sell-desc').textContent   = `${wPrice}🪙 each`);
  _elf('corn-sell-desc')   && (_elf('corn-sell-desc').textContent    = `${cPrice}🪙 each`);
  _elf('pumpkin-sell-desc')&& (_elf('pumpkin-sell-desc').textContent = `${pkPrice}🪙 each`);
  _elf('truffle-sell-desc')&& (_elf('truffle-sell-desc').textContent = npcLevel('ellie')>=5 ? `${trPrice}🪙 (Royal Purveyor 2.2×!)` : `${trPrice}🪙 each`);
  _elf('wheat-sell-price') && (_elf('wheat-sell-price').textContent   = `🪙${wPrice}`);
  _elf('corn-sell-price')  && (_elf('corn-sell-price').textContent    = `🪙${cPrice}`);
  _elf('pumpkin-sell-price')&&(_elf('pumpkin-sell-price').textContent = `🪙${pkPrice}`);
  _elf('truffle-sell-price')&&(_elf('truffle-sell-price').textContent = `🪙${trPrice}`);

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
  _elf('fert-desc')         && (_elf('fert-desc').textContent    = `Apply to one growing plot · +${fYield} yield on harvest`);
  _elf('bigfert-cost-tag')  && (_elf('bigfert-cost-tag').textContent = bfCost === 0 ? 'FREE!' : `🪙${bfCost}`);
  _elf('bigfert-desc')      && (_elf('bigfert-desc').textContent  = `Fertilizes all growing plots · +${bfYield} yield each`);

  const gChance = glovesChancePct();
  const gMax    = glovesMaxUses();
  const gUsesStr = gMax === Infinity ? 'unlimited uses' : `${gMax} uses`;
  _elf('gloves-desc') && (_elf('gloves-desc').textContent = `${gChance}% seed recovery on harvest · ${gUsesStr}`);

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
      const maxed      = npc.affinity >= 15;
      const lvl        = affinityLevel(id);

      const hearts = '♥'.repeat(lvl);
      const emptyH = '♡'.repeat(Math.max(0, 5 - lvl));

      const affinityInLevel = npc.affinity % 3;
      const nextLevelAt     = lvl < 5 ? (lvl * 3) + 3 : 15;
      const progressPct     = lvl >= 5 ? 100 : Math.round((npc.affinity / nextLevelAt) * 100);

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
              <div class="affinity-bar-track"><div class="affinity-bar-fill" style="width:${progressPct}%"></div></div>
              <div class="affinity-hearts-row"><span style="color:var(--gold)">${hearts}</span><span style="color:var(--text3)">${emptyH}</span><span class="affinity-pts-label">${npc.affinity}/15</span></div>
            </div>
          </div>
          <div class="npc-expand-chevron">${npc.expanded ? '▲' : '▼'}</div>
        </div>
        ${expandedPanel}
        ${bodyHtml}
      `;
      list.appendChild(card);
    });

  list.querySelectorAll('[data-toggle-npc]').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('[data-deliver]')) return;
      const npcId = header.dataset.toggleNpc;
      import('./npcs.js').then(({ toggleNpcExpanded }) => toggleNpcExpanded(npcId));
    });
  });

  updateTownBadge();
}

export function tickTownCooldowns() {
  document.querySelectorAll('.cooldown-msg[data-until]').forEach(span => {
    const until = parseInt(span.dataset.until);
    const secs  = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    span.textContent = formatTime(secs);
  });
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
    { icon:'💧', label:'Manually Watered',            val: s.totalWatered      || 0 },
    { icon:'🌿', label:'Manually Fertilized',         val: s.totalFertilized   || 0 },
    { icon:'🏪', label:'Sell Actions',                val: s.sellActions       || 0 },
    { icon:'💀', label:'Crops Lost to Weather',       val: s.cropsLostToWeather|| 0 },
    { icon:'🍄', label:'Truffles Harvested',          val: s.truffleHarvests   || 0 },
    { icon:'🧤', label:'Gloves Uses',                 val: s.glovesUses        || 0 },
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

// ── MERCHANT UI ───────────────────────────────────────────
export function updateMerchantUI() {
  import('./merchants.js').then(M => {
    const m   = state.merchant;
    const sun = el('merchant-mochi');
    const moon= el('merchant-moto');
    if (!sun || !moon) return;

    sun.style.display  = (m.active === 'mochi') ? 'flex' : 'none';
    moon.style.display = (m.active === 'moto')  ? 'flex' : 'none';

    const effBadge = el('merchant-effect-badge');
    if (effBadge) {
      const eff = m.effect;
      const now = Date.now();
      if (eff && eff.id && (!eff.expiresAt || now < eff.expiresAt)) {
        const mins = eff.expiresAt ? Math.ceil((eff.expiresAt - now) / 60000) : null;
        const uses = eff.usesLeft !== undefined ? `${eff.usesLeft} left` : null;
        const timeStr = uses || (mins !== null ? `${mins}m` : '');
        effBadge.textContent = `${eff.icon} ${eff.label}${timeStr ? ' · ' + timeStr : ''}`;
        effBadge.style.display = 'flex';
        const pill2 = el('grid-size-badge');
        if (pill2) pill2.style.display = 'none';
      } else {
        effBadge.style.display = 'none';
        const pill2 = el('grid-size-badge');
        if (pill2) pill2.style.display = '';
      }
    }

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
  const effBadge = el('merchant-effect-badge');
  if (!effBadge) return;
  const m   = state.merchant;
  const eff = m && m.effect;
  const now = Date.now();
  if (eff && eff.id && (!eff.expiresAt || now < eff.expiresAt)) {
    let timeStr = '';
    if (eff.usesLeft !== undefined) {
      timeStr = `${eff.usesLeft} use${eff.usesLeft !== 1 ? 's' : ''} left`;
    } else if (eff.expiresAt) {
      const secsLeft = Math.max(0, Math.ceil((eff.expiresAt - now) / 1000));
      const h = Math.floor(secsLeft / 3600);
      const m2 = Math.floor((secsLeft % 3600) / 60);
      const s = secsLeft % 60;
      if (h > 0)       timeStr = `${h}h ${m2}m`;
      else if (m2 > 0) timeStr = `${m2}m ${s}s`;
      else             timeStr = `${s}s`;
    }
    effBadge.textContent  = `${eff.icon} ${eff.label}${timeStr ? ' · ' + timeStr : ''}`;
    effBadge.style.display = 'flex';
    const pill = el('grid-size-badge');
    if (pill) pill.style.display = 'none';
  } else {
    effBadge.style.display = 'none';
    const pill = el('grid-size-badge');
    if (pill) pill.style.display = '';
  }
}

export function openMerchantModal(who) {
  import('./merchants.js').then(M => {
    const modal = el('merchant-modal');
    if (!modal) return;
    const m = state.merchant;
    if (m.active !== who) return;

    const cost = who === 'mochi' ? M.mochiCostForDisplay() : M.motoCostForDisplay();
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
      declineBtn.textContent = who === 'mochi'
        ? "Not today. Send Moto."
        : "Too risky. Send Mochi.";
    }

    modal.dataset.who = who;
    modal.classList.add('open');

    itemsEl.querySelectorAll('[data-buy-mochi]').forEach(btn => {
      btn.addEventListener('click', () => {
        M.buyMochiItem(btn.dataset.buyMochi);
        modal.classList.remove('open');
      });
    });
    itemsEl.querySelectorAll('[data-buy-moto]').forEach(btn => {
      btn.addEventListener('click', () => {
        M.buyMotoRiddle(btn.dataset.buyMoto);
        modal.classList.remove('open');
      });
    });
  });
}
