// ── MAIN ENTRY POINT ──────────────────────────────────────
// Owns: tick loop, player input handlers, game actions.
// All modules share the single `state` object by reference.

import {
  state, settings,
  saveState, loadState, saveSetting, loadSettings, clearState,
  CROPS, WEATHER_TYPES, WEATHER_DURATION_MS, ACHIEVEMENTS,
  WATER_COST, WATER_HOSE_COST, WATER_SPEEDUP,
  FERT_COST, BIG_FERT_COST, FERT_YIELD,
  GLOVES_COST, GLOVES_USES, GLOVES_CHANCE,
  BARN_UPGRADES, EXPAND_BASE, EXPAND_MULT, MAX_ROWS, MAX_COLS,
  barnCap, totalBarnContents, expandCost, initPlots,
  currentWeatherMultiplier, pickWeather, formatTime, migrateState,
  computeGrowMs, computeEffectiveElapsed,
} from './state.js';

import {
  migrateNpcs, tickNpcs, deliverRequest as npcDeliver,
  NPC_ORDER,
  getGlovesUses, getGlovesChance,
  getWheatSellMult, getWheatYieldBonus, getWheatWeatherImmune,
  getTruffleSellPrice, getTruffleGrowMult, getTruffleMinYield,
  getCornYieldBonus, getCornSellMult, getCornGrowMult, rollCornInstant,
  getPumpkinSellMult, getPumpkinWeatherMult,
  getWaterSpeedup, getWaterHoseCost, getWaterHoseAreaBoost, getWaterAreaSize,
  getFertYield, getBigFertCost, getBigFertYield, getFertInstantChance,
} from './npcs.js';

import {
  tickMerchants, isMerchantUnlocked,
  getMerchantSellMult, isBarnWeightless, getMiracleYield,
  isTimerFrozen, isBarrenEarth, isPhotosynthActive, getStickyDelay,
  consumeTripleSellUse, dismissMerchant, declineMerchant,
} from './merchants.js';

import {
  el, toast, applyTheme, switchTab,
  renderGrid, renderPlot, updateHeader, updateFarmToolbar,
  updateHint, updateBegZone, updateShopUI,
  updateWeatherBanner, updateTownVisibility, updateTownBadge,
  renderTownTab, tickTownCooldowns, renderLogTab,
  updateMerchantUI, openMerchantModal, tickMerchantBadge,
} from './ui.js';

// ── INTERACTION STATE ─────────────────────────────────────
let selectedCrop = 'wheat';
let selectedTool = 'plant'; // 'plant' | 'water' | 'fert'
let notifiedPlots = new Set();
let lastHarvestTime = 0; // for Moto sticky fingers throttle

// Helper to get affinity level for an NPC without importing affinityLevel
function affinityLevelFor(npcId) {
  return Math.min(5, Math.floor((state.npcs[npcId]?.affinity || 0) / 3));
}

// ── TOOL / CROP SELECTION ─────────────────────────────────
function selectCrop(type) {
  selectedCrop = type;
  selectedTool = 'plant';
  updateFarmToolbar(selectedCrop, selectedTool);
}

function selectTool(tool) {
  selectedTool = (selectedTool === tool) ? 'plant' : tool;
  updateFarmToolbar(selectedCrop, selectedTool);
}


/** Record when a plot was watered. The tick loop uses wateredAt to compute speedup. */
function applyWaterSpeedup(plot) {
  plot.wateredAt = Date.now();
}
// ── PLOT INTERACTIONS ─────────────────────────────────────
function clickPlot(idx) {
  const plot = state.plots[idx];

  if (selectedTool === 'water') {
    if (plot.state === 'flooded') { toast('🌊 This plot is flooded!'); return; }
    if (plot.state === 'ready') { harvestPlot(idx); return; }
    if (plot.state !== 'planted') { toast('Plant a crop first!'); return; }
    if (plot.watered) { toast('Already watered!'); return; }
    if ((state.water || 0) < 1) { toast('No water! Buy some in the Shop.'); return; }
    state.water--;
    const areaSize = getWaterAreaSize(); // 0 = single plot, 1 = 3x3
    if (areaSize > 0) {
      // 3x3 area around the tapped plot
      const row = Math.floor(idx / state.cols);
      const col = idx % state.cols;
      let wetCount = 0;
      for (let dr = -areaSize; dr <= areaSize; dr++) {
        for (let dc = -areaSize; dc <= areaSize; dc++) {
          const r2 = row + dr, c2 = col + dc;
          if (r2 < 0 || r2 >= state.rows || c2 < 0 || c2 >= state.cols) continue;
          const p2 = state.plots[r2 * state.cols + c2];
          if (p2 && p2.state === 'planted' && !p2.watered) {
            p2.watered = true;
            applyWaterSpeedup(p2);
            wetCount++;
          }
        }
      }
      state.stats.totalWatered = (state.stats.totalWatered || 0) + 1;
      saveState(); renderGrid(); updateHeader(); updateShopUI(); updateFarmToolbar(selectedCrop, selectedTool);
      toast(`💧✨ Cinna's blessing! Watered ${wetCount} plot${wetCount !== 1 ? 's' : ''} in a 3×3 area!`);
    } else {
      plot.watered = true;
      applyWaterSpeedup(plot);
      state.stats.totalWatered = (state.stats.totalWatered || 0) + 1;
      saveState(); renderPlot(idx); updateHeader(); updateShopUI(); updateFarmToolbar(selectedCrop, selectedTool);
      toast('💧 Watered! Growing faster.');
    }
    checkAchievements();
    return;
  }

  if (selectedTool === 'fert') {
    if (plot.state === 'flooded') { toast('🌊 This plot is flooded!'); return; }
    if (plot.state === 'ready') { harvestPlot(idx); return; }
    if (plot.state !== 'planted') { toast('Plant a crop first!'); return; }
    if (plot.fertilized) { toast('Already fertilized!'); return; }
    if ((state.fertilizer || 0) < 1) { toast('No fertilizer! Buy some in the Shop.'); return; }
    state.fertilizer--;
    plot.fertilized = true;
    state.stats.totalFertilized = (state.stats.totalFertilized || 0) + 1;
    saveState();
    renderPlot(idx);
    updateHeader();
    updateShopUI();
    updateFarmToolbar(selectedCrop, selectedTool);
    toast('🌿 Fertilized! Extra yield on harvest.');
    checkAchievements();
    return;
  }

  // Flooded plots are uninteractable
  if (plot.state === 'flooded') {
    toast('🌊 This plot is flooded! Wait for the flood to pass.');
    return;
  }

  // Plant mode (default)
  if (plot.state === 'empty') {
    const seedKey = selectedCrop + 'Seeds';
    if ((state[seedKey] || 0) < 1) {
      toast(`No ${CROPS[selectedCrop].name} seeds! Buy some in the Shop.`);
      return;
    }
    state[seedKey]--;
    plot.state      = 'planted';
    plot.crop       = selectedCrop;
    plot.plantedAt  = Date.now();
    plot.watered    = false;
    plot.fertilized = false;
    // Twins L4: 10% chance corn grows instantly — roll once at plant time
    if (selectedCrop === 'corn' && rollCornInstant()) {
      plot.state = 'ready';
      toast('⚡ Chaos Corn! This one grew instantly!');
    }
    saveState();
    renderPlot(idx);
    updateHeader();
    updateFarmToolbar(selectedCrop, selectedTool);
  } else if (plot.state === 'planted') {
    showPlotOptions(idx);
  } else if (plot.state === 'ready') {
    harvestPlot(idx);
  }
}

function showPlotOptions(idx) {
  const plot           = state.plots[idx];
  const cropKey        = plot.crop || 'wheat';
  const weatherMult    = currentWeatherMultiplier();
  const currentWeather = (state.weather && state.weather.current) || 'clear';
  const isBadWeather   = ['rain', 'thunder', 'flood'].includes(currentWeather);
  const growMs = computeGrowMs(cropKey, weatherMult, isBadWeather, {
    truffleGrowMult:    getTruffleGrowMult(),
    cornGrowMult:       getCornGrowMult(),
    pumpkinWeatherMult: getPumpkinWeatherMult(),
    kalbiL5:            affinityLevelFor('kalbi') >= 5,
    photosynthActive:   isPhotosynthActive(),
  });
  const effectiveElapsed = computeEffectiveElapsed(plot, getWaterSpeedup() ?? WATER_SPEEDUP);
  const remaining = Math.max(0, Math.ceil((growMs - effectiveElapsed) / 1000));

  const mods = [];
  if (plot.watered)    mods.push('💧 watered');
  if (plot.fertilized) mods.push('🌿 fertilized');
  const modStr  = mods.length ? ` · ${mods.join(' · ')}` : '';

  const hints = [];
  if (!plot.watered    && (state.water      || 0) > 0) hints.push('use 💧 water mode');
  if (!plot.fertilized && (state.fertilizer || 0) > 0) hints.push('use 🌿 fert mode');
  const hintStr = hints.length ? `\n${hints.join(' · ')}` : '';

  toast(`⏳ ${formatTime(remaining)} left${modStr}${hintStr}`);
}

function harvestPlot(idx) {
  // Moto sticky fingers: throttle harvests to 1 per 10s
  const stickyDelay = getStickyDelay();
  if (stickyDelay > 0 && Date.now() - lastHarvestTime < stickyDelay) {
    const remaining = Math.ceil((stickyDelay - (Date.now() - lastHarvestTime)) / 1000);
    toast(`🐌 Sticky Fingers! Wait ${remaining}s before next harvest.`);
    return;
  }
  lastHarvestTime = Date.now();

  const plot    = state.plots[idx];
  const crop    = CROPS[plot.crop || 'wheat'];
  const cropKey = plot.crop || 'wheat';

  let yieldAmt = crop.yield;

  // Kola: enhanced fertilizer yield
  if (plot.fertilized) {
    const fertBonus = getFertYield();
    yieldAmt += (fertBonus !== null ? fertBonus : FERT_YIELD);
  }

  // Moto miracle harvest: +5 yield (overrides fertilizer, applied last)
  const miracleBonus = getMiracleYield();
  if (miracleBonus > 0) yieldAmt += miracleBonus;

  // Kalbi: wheat yield bonus
  if (cropKey === 'wheat') {
    const wheatBonus = getWheatYieldBonus();
    if (wheatBonus && Math.random() < wheatBonus.chance) {
      yieldAmt += wheatBonus.extra;
    }
  }

  // Twins: corn yield bonus
  if (cropKey === 'corn') yieldAmt += getCornYieldBonus();

  // Ellie: truffle min yield
  if (cropKey === 'truffle') yieldAmt = Math.max(getTruffleMinYield(), yieldAmt);

  const weightless = isBarnWeightless();
  const space = weightless ? Infinity : (barnCap() - totalBarnContents());
  if (!weightless && space <= 0) { toast('🏚️ Barn full! Sell some crops first.'); return; }

  // Partial harvest: take only what fits, leave the plot as ready if there's more
  const partialHarvest = !weightless && yieldAmt > space;
  const actualHarvest = weightless ? yieldAmt : Math.min(yieldAmt, space);
  yieldAmt = actualHarvest;

  state[cropKey] = (state[cropKey] || 0) + yieldAmt;

  // Maru L2: 10% chance to find a truffle when harvesting pumpkin
  if (cropKey === 'pumpkin' && affinityLevelFor('maru') >= 2 && Math.random() < 0.10) {
    const truffleSpace = barnCap() - totalBarnContents();
    if (truffleSpace > 0) {
      state.truffle = (state.truffle || 0) + 1;
      toast('🍄 Maru\'s instincts found a Truffle!');
    }
  }

  // Maru L5: +1 yield to all other growing pumpkins
  if (cropKey === 'pumpkin' && affinityLevelFor('maru') >= 5) {
    state.plots.forEach((p, i) => {
      if (i !== idx && p.state !== 'empty' && p.crop === 'pumpkin') {
        const s = barnCap() - totalBarnContents();
        if (s > 0) { state.pumpkin = (state.pumpkin || 0) + 1; }
      }
    });
  }

  // Kola L5: fertilizer triggers instant growth (handled at fertilize time, but also
  // at harvest we note if the 25% proc is already applied from planting — no action needed here)

  // Gloves seed-recovery
  let seedReturned = false;
  const curGlovesUses = getGlovesUses();
  const glovesChance  = isBarrenEarth() ? 0 : (getGlovesChance() !== null ? getGlovesChance() : GLOVES_CHANCE);
  const glovesMax     = curGlovesUses === Infinity ? Infinity : (curGlovesUses !== null ? curGlovesUses : GLOVES_USES);

  if (state.glovesDurability > 0) {
    if (Math.random() < glovesChance) {
      const seedKey = cropKey + 'Seeds';
      state[seedKey] = (state[seedKey] || 0) + 1;
      seedReturned = true;
    }
    if (curGlovesUses !== Infinity) {
      state.glovesDurability--;
      state.stats.glovesUses = (state.stats.glovesUses || 0) + 1;
      if (state.glovesDurability === 0) toast('🧤 Gloves worn out! Buy new ones.');
    } else {
      // Golden Mitts — never decrement
      state.stats.glovesUses = (state.stats.glovesUses || 0) + 1;
    }
  }

  if (!partialHarvest) {
    plot.state      = 'empty';
    plot.crop       = null;
    plot.plantedAt  = null;
    plot.watered    = false;
    plot.fertilized = false;
    plot.wateredAt  = null;
    notifiedPlots.delete(idx);
  }
  // Partial: plot stays 'ready' so player can harvest the rest after making barn space

  state.stats.totalHarvests   = (state.stats.totalHarvests  || 0) + 1;
  if (cropKey === 'wheat')   state.stats.wheatHarvests  = (state.stats.wheatHarvests  || 0) + 1;
  if (cropKey === 'truffle') state.stats.truffleHarvests = (state.stats.truffleHarvests || 0) + 1;

  saveState();
  renderPlot(idx);
  updateHeader();
  updateShopUI();
  updateFarmToolbar(selectedCrop, selectedTool);
  const partialMsg = partialHarvest ? ` (${space} fit — sell to grab the rest!)` : '';
  toast(`${crop.emoji} Harvested ${yieldAmt} ${crop.name}!${seedReturned ? ' 🌱 Seed returned!' : ''}${partialMsg}`);
  updateHint();
  updateBegZone();
  checkAchievements();
}

// ── SELL FUNCTIONS ────────────────────────────────────────
function sellAllCrops() {
  const total = totalBarnContents();
  if (total === 0) { toast('Nothing in the barn!'); return; }
  let earned = 0;
  ['wheat', 'corn', 'pumpkin', 'truffle'].forEach(k => {
    if (state[k] > 0) {
      let price = CROPS[k].sellPrice;
      if (k === 'wheat')   price = Math.round(price * getWheatSellMult());
      if (k === 'corn')    price = Math.round(price * getCornSellMult());
      if (k === 'pumpkin') price = Math.round(price * getPumpkinSellMult());
      if (k === 'truffle') price = getTruffleSellPrice(price);
      // Merchant flat multiplier (Helios or Triple Sell) applied last
      const mMult = getMerchantSellMult();
      if (mMult !== 1.0) {
        const before = state[k];
        price = Math.round(price * mMult);
        // Triple sell consumes uses per item sold
        if (mMult === 3.0) for (let _i = 0; _i < before; _i++) consumeTripleSellUse();
      }
      earned += state[k] * price;
      state[k] = 0;
    }
  });
  state.coins       += earned;
  const prev         = state.lifetimeCoins || 0;
  state.lifetimeCoins = prev + earned;
  state.stats.sellActions = (state.stats.sellActions || 0) + 1;
  checkUnlocks(prev, state.lifetimeCoins);
  saveState();
  updateHeader(); updateShopUI(); updateFarmToolbar(selectedCrop, selectedTool);
  toast(`🪙 Sold everything for ${earned} coins!`);
  checkAchievements(); updateBegZone();
}

function sellCrop(cropKey, amount) {
  const stock = state[cropKey] || 0;
  if (stock === 0) { toast(`No ${CROPS[cropKey].name} to sell!`); return; }
  const qty = amount === 'all' ? stock : Math.min(amount, stock);

  // Apply NPC sell price bonuses
  let basePrice = CROPS[cropKey].sellPrice;
  if (cropKey === 'wheat')   basePrice = Math.round(basePrice * getWheatSellMult());
  if (cropKey === 'corn')    basePrice = Math.round(basePrice * getCornSellMult());
  if (cropKey === 'pumpkin') basePrice = Math.round(basePrice * getPumpkinSellMult());
  if (cropKey === 'truffle') basePrice = getTruffleSellPrice(basePrice);
  // Merchant flat multiplier applied last
  const mMult = getMerchantSellMult();
  if (mMult === 3.0) for (let _i = 0; _i < qty; _i++) consumeTripleSellUse();
  basePrice = Math.round(basePrice * getMerchantSellMult());

  const earned = qty * basePrice;
  state[cropKey]     -= qty;
  state.coins        += earned;
  const prev          = state.lifetimeCoins || 0;
  state.lifetimeCoins = prev + earned;
  state.stats.sellActions = (state.stats.sellActions || 0) + 1;
  checkUnlocks(prev, state.lifetimeCoins);
  saveState();
  updateHeader(); updateShopUI(); updateFarmToolbar(selectedCrop, selectedTool);
  toast(`🪙 Sold ${qty === 1 ? `1 ${CROPS[cropKey].name}` : `${qty} ${CROPS[cropKey].name}`} for ${earned} coins!`);
  checkAchievements();
}

function checkUnlocks(prev, next) {
  Object.entries(CROPS).forEach(([, crop]) => {
    if (crop.unlockCoins && prev < crop.unlockCoins && next >= crop.unlockCoins) {
      toast(`🔓 ${crop.emoji} ${crop.name} seeds unlocked! Check the Shop.`);
    }
  });
}

// ── BUY FUNCTIONS ─────────────────────────────────────────
function buySeeds(cropKey, n) {
  const cost = n * CROPS[cropKey].seedCost;
  if (state.coins < cost) { toast(`Need ${cost}🪙!`); return; }
  state.coins -= cost;
  const seedKey = cropKey + 'Seeds';
  state[seedKey] = (state[seedKey] || 0) + n;
  saveState();
  updateHeader(); updateShopUI(); updateFarmToolbar(selectedCrop, selectedTool);
  toast(`${CROPS[cropKey].seedling} Bought ${n} ${CROPS[cropKey].name} seed${n > 1 ? 's' : ''}!`);
}

function buyWater(n) {
  const cost = n * WATER_COST;
  if (state.coins < cost) { toast(`Need ${cost}🪙!`); return; }
  state.coins -= cost;
  state.water  = (state.water || 0) + n;
  state.stats.everBoughtWater = true;
  saveState();
  updateHeader(); updateShopUI(); updateFarmToolbar(selectedCrop, selectedTool); updateHint();
  toast(`💧 Bought ${n} water!`);
}

function buyFertilizer(n) {
  const cost = n * FERT_COST;
  if (state.coins < cost) { toast(`Need ${cost}🪙!`); return; }
  state.coins     -= cost;
  state.fertilizer = (state.fertilizer || 0) + n;
  state.stats.everBoughtFert = true;
  saveState();
  updateHeader(); updateShopUI(); updateFarmToolbar(selectedCrop, selectedTool); updateHint();
  toast(`🌿 Bought ${n} fertilizer!`);
}

function buyWaterHose() {
  const cost = getWaterHoseCost(WATER_HOSE_COST);
  if (state.coins < cost) { toast(`Need ${cost}🪙!`); return; }
  const targets = state.plots.filter(p => p.state === 'planted' && !p.watered);
  if (targets.length === 0) { toast('No unwatered growing plots!'); return; }
  state.coins -= cost;
  // Cinna L5: 2×2 area boost — water affects each plot + its neighbours
  if (getWaterHoseAreaBoost()) {
    state.plots.forEach(p => { if (p.state === 'planted' && !p.watered) { p.watered = true; applyWaterSpeedup(p); } });
    const wetted = state.plots.filter(p => p.state === 'planted' && p.watered).length;
    saveState(); renderGrid(); updateHeader(); updateShopUI();
    toast(`💧✨ Torrent! All ${wetted} plots soaked${cost === 0 ? ' (free!)' : ''}!`);
  } else {
    targets.forEach(p => { p.watered = true; applyWaterSpeedup(p); });
    saveState(); renderGrid(); updateHeader(); updateShopUI();
    toast(`💧 Watered all ${targets.length} growing plot${targets.length > 1 ? 's' : ''}!${cost === 0 ? ' (free!)' : ''}`);
  }
}

function buyBigFertilizer() {
  const cost = getBigFertCost(BIG_FERT_COST);
  if (state.coins < cost) { toast(`Need ${cost}🪙!`); return; }
  const targets = state.plots.filter(p => p.state === 'planted' && !p.fertilized);
  if (targets.length === 0) { toast('No unfertilized growing plots!'); return; }
  state.coins -= cost;
  targets.forEach(p => { p.fertilized = true; });
  // Kola L5: 25% chance fertilizer triggers instant growth
  const instantChance = getFertInstantChance();
  if (instantChance > 0) {
    targets.forEach(p => { if (Math.random() < instantChance) p.state = 'ready'; });
  }
  const bigYield = getBigFertYield();
  const yieldMsg = bigYield !== null ? ` (+${bigYield} yield!)` : '';
  saveState(); renderGrid(); updateHeader(); updateShopUI();
  toast(`🌿 Fertilized all ${targets.length} plot${targets.length > 1 ? 's' : ''}!${yieldMsg}${cost === 0 ? ' (free!)' : ''}`);
}

function buyGloves() {
  if ((state.stats.wheatHarvests || 0) < 20) { toast('🧤 Harvest 20 wheat first to unlock Gloves!'); return; }
  if (state.glovesDurability > 0) { toast('Gloves still have durability!'); return; }
  if (state.coins < GLOVES_COST) { toast(`Need ${GLOVES_COST}🪙!`); return; }
  state.coins -= GLOVES_COST;
  const uses = getGlovesUses();
  state.glovesDurability = uses === Infinity ? 9999 : (uses !== null ? uses : GLOVES_USES);
  saveState(); updateHeader(); updateShopUI();
  const usesLabel = uses === Infinity ? 'unlimited uses ✨' : `${state.glovesDurability} uses`;
  toast(`🧤 Gloves equipped! ${usesLabel}.`);
}

function upgradeBarn() {
  const nextLevel = (state.barnLevel || 0) + 1;
  if (nextLevel > BARN_UPGRADES.length) { toast('Max barn size!'); return; }
  const upgrade = BARN_UPGRADES[nextLevel - 1];
  if (state.coins < upgrade.cost) { toast(`Need ${upgrade.cost}🪙!`); return; }
  state.coins    -= upgrade.cost;
  state.barnLevel = nextLevel;
  saveState();
  updateHeader(); updateShopUI(); updateTownVisibility();
  toast(`🏚️ Barn upgraded! Now holds ${upgrade.cap} crops.`);
}

// ── EXPAND FARM ───────────────────────────────────────────
function expandGrid(type) {
  if (type === 'row' && state.rows >= MAX_ROWS) { toast(`Max ${MAX_ROWS} rows reached!`); return; }
  if (type === 'col' && state.cols >= MAX_COLS) { toast(`Max ${MAX_COLS} columns reached!`); return; }
  const cost = expandCost(type);
  if (state.coins < cost) { toast(`Need ${cost}🪙 to expand!`); return; }
  state.coins -= cost;
  if (type === 'row') { state.rows++; state.rowExpands++; }
  else                { state.cols++; state.colExpands++; }
  initPlots();
  saveState();
  renderGrid(); updateHeader(); updateShopUI(); updateTownVisibility();
  toast(type === 'row' ? '🏡 New row added!' : '🏡 New column added!');
  checkAchievements();
}

// ── BEG SYSTEM ────────────────────────────────────────────
function begForSeeds() {
  state.begTaps = (state.begTaps || 0) + 1;
  if (state.begTaps >= 10) {
    state.wheatSeeds = (state.wheatSeeds || 0) + 1;
    state.begTaps    = 0;
    saveState();
    updateHeader(); updateFarmToolbar(selectedCrop, selectedTool); updateBegZone();
    toast('🙏 A kind stranger gave you 1 wheat seed!');
  } else {
    saveState();
    const prog = el('beg-progress');
    if (prog) prog.textContent = `${state.begTaps}/10 taps… keep going`;
  }
}

// ── ACHIEVEMENTS ──────────────────────────────────────────
function checkAchievements() {
  if (!state.unlockedAchievements) state.unlockedAchievements = [];
  let newUnlock = false;
  ACHIEVEMENTS.forEach(a => {
    if (!state.unlockedAchievements.includes(a.id)) {
      try {
        if (a.check(state)) {
          state.unlockedAchievements.push(a.id);
          newUnlock = true;
          setTimeout(() => toast(`🏆 Achievement unlocked: ${a.name}!`), 800);
        }
      } catch (e) { /* guard against bad state */ }
    }
  });
  if (newUnlock) {
    saveState();
    const logPanel = el('tab-log');
    if (logPanel && logPanel.classList.contains('active')) renderLogTab();
  }
}

// ── WEATHER ───────────────────────────────────────────────
const WEATHER_EVENT_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ── Called once when weather first changes ────────────────
function onWeatherStart(id) {
  if (!state.stats.weatherCounts) state.stats.weatherCounts = {};
  state.stats.weatherCounts[id] = (state.stats.weatherCounts[id] || 0) + 1;

  if (id === 'rain') {
    doRainWater();
  } else if (id === 'thunder') {
    doThunderZap();
  } else if (id === 'flood') {
    doFloodStart();
  } else if (id === 'sunny') {
    toast('☀️ Sunny! Crops growing 20% faster all hour.');
  } else if (id === 'overcast') {
    if (isPhotosynthActive()) {
      toast('☁️ Overcast — blocked by Photosynthesis! No slowdown.');
    } else {
      toast('☁️ Overcast. Crops growing 20% slower all hour.');
    }
  } else {
    toast('🌤️ Skies have cleared up.');
  }
}

// ── Recurring rain: water all unwatered plots ─────────────
function doRainWater() {
  let count = 0;
  state.plots.forEach(p => {
    if (p.state === 'planted' && !p.watered) { p.watered = true; applyWaterSpeedup(p); count++; }
  });
  state.weather.lastRainAt = Date.now();
  state.stats.rainWateredPlots = (state.stats.rainWateredPlots || 0) + count;
  if (count > 0) {
    toast(`🌧️ Rain watered ${count} plot${count > 1 ? 's' : ''}!`);
    renderGrid();
  } else {
    toast('🌧️ Rain — all plots already watered!');
  }
  checkAchievements(); // always check — catches first-ever rain-watered event
}

// ── Recurring thunder: zap 1–5 random plots ──────────────
function doThunderZap() {
  const wheatImmune = getWheatWeatherImmune();
  const occupied = state.plots
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.state !== 'empty' && !(wheatImmune && p.crop === 'wheat'));
  state.weather.lastThunderAt = Date.now();
  if (occupied.length > 0) {
    const zapCount = Math.min(occupied.length, Math.floor(Math.random() * 5) + 1);
    for (let i = occupied.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [occupied[i], occupied[j]] = [occupied[j], occupied[i]];
    }
    occupied.slice(0, zapCount).forEach(({ p, i }) => {
      p.state = 'empty'; p.crop = null; p.plantedAt = null; p.watered = false; p.fertilized = false;
      notifiedPlots.delete(i);
    });
    state.stats.cropsLostToWeather = (state.stats.cropsLostToWeather || 0) + zapCount;
    state.stats.thunderSurvived    = (state.stats.thunderSurvived    || 0) + 1;
    const immuneMsg = wheatImmune ? ' (Wheat safe — Kalbi!)' : '';
    toast(`⛈️ Lightning! ${zapCount} crop${zapCount > 1 ? 's' : ''} zapped! 💀${immuneMsg}`);
    renderGrid(); checkAchievements();
  } else {
    state.stats.thunderSurvived = (state.stats.thunderSurvived || 0) + 1;
    toast('⛈️ Thunder rumbles… (nothing to zap)');
    checkAchievements();
  }
}

// ── Flood start: wipe a row and lock it ──────────────────
function doFloodStart() {
  if (isPhotosynthActive()) {
    toast('🌿 Photosynthesis blocked the flood!');
    state.weather.floodedRow = -1;
    return;
  }
  const wheatImmune = getWheatWeatherImmune();
  // Pick any row (not just occupied) — the row gets locked either way
  const row = Math.floor(Math.random() * state.rows);
  state.weather.floodedRow = row;
  let lost = 0;
  for (let c = 0; c < state.cols; c++) {
    const idx = row * state.cols + c;
    const p = state.plots[idx];
    if (p && p.state !== 'empty' && !(wheatImmune && p.crop === 'wheat')) {
      state.plots[idx] = { state: 'flooded', crop: null, plantedAt: null, watered: false, fertilized: false, wateredAt: null };
      notifiedPlots.delete(idx);
      lost++;
    } else if (p && p.state === 'empty') {
      state.plots[idx] = { state: 'flooded', crop: null, plantedAt: null, watered: false, fertilized: false, wateredAt: null };
    }
  }
  state.stats.cropsLostToWeather = (state.stats.cropsLostToWeather || 0) + lost;
  state.stats.floodSurvived      = (state.stats.floodSurvived      || 0) + 1;
  const immuneMsg = wheatImmune ? ' (Wheat survived — Kalbi!)' : '';
  const lostMsg = lost > 0 ? ` ${lost} crop${lost > 1 ? 's' : ''} lost.` : '';
  toast(`🌊 Flood! Row ${row + 1} submerged for the hour!${lostMsg}${immuneMsg}`);
  renderGrid(); checkAchievements();
}

// ── Flood end: restore flooded plots to empty ─────────────
function doFloodEnd() {
  state.plots.forEach((p, i) => {
    if (p.state === 'flooded') {
      state.plots[i] = { state: 'empty', crop: null, plantedAt: null, watered: false, fertilized: false, wateredAt: null };
    }
  });
  state.weather.floodedRow = -1;
  toast('🌊 Flood receded! Row is usable again.');
  renderGrid();
}

function tickWeather() {
  if (!state.weather) state.weather = { current: 'clear', changedAt: Date.now(), lastRainAt: 0, lastThunderAt: 0, floodedRow: -1 };
  const now     = Date.now();
  const elapsed = now - state.weather.changedAt;
  const cur     = state.weather.current;

  if (elapsed >= WEATHER_DURATION_MS) {
    // Weather is ending — clear flood row if active
    if (cur === 'flood' && state.weather.floodedRow >= 0) doFloodEnd();
    const newW = pickWeather();
    state.weather.current        = newW;
    state.weather.changedAt      = now;
    state.weather.lastRainAt     = 0;
    state.weather.lastThunderAt  = 0;
    state.weather.floodedRow     = -1;
    saveState();
    onWeatherStart(newW);
  } else {
    // Recurring events during active weather
    if (cur === 'rain' && now - (state.weather.lastRainAt || 0) >= WEATHER_EVENT_INTERVAL) {
      doRainWater();
      saveState();
    }
    if (cur === 'thunder' && now - (state.weather.lastThunderAt || 0) >= WEATHER_EVENT_INTERVAL) {
      doThunderZap();
      saveState();
    }
  }

  updateWeatherBanner();
}

// ── TICK LOOP ─────────────────────────────────────────────
function tick() {
  tickWeather();
  tickNpcs();
  tickMerchants();
  tickMerchantBadge();
  tickTownCooldowns();

  const weatherMult = currentWeatherMultiplier();
  const currentWeather = (state.weather && state.weather.current) || 'clear';
  const isBadWeather = ['rain', 'thunder', 'flood'].includes(currentWeather);
  let changed = false;

  state.plots.forEach((plot, i) => {
    if (plot.state === 'flooded') return; // locked during flood
    if (plot.state === 'planted') {
      // Moto frozen soil: skip timer advancement
      if (isTimerFrozen()) { renderPlot(i); return; }

      const cropKey = plot.crop || 'wheat';
      const growMs  = computeGrowMs(cropKey, weatherMult, isBadWeather, {
        truffleGrowMult:    getTruffleGrowMult(),
        cornGrowMult:       getCornGrowMult(),
        pumpkinWeatherMult: getPumpkinWeatherMult(),
        kalbiL5:            affinityLevelFor('kalbi') >= 5,
        photosynthActive:   isPhotosynthActive(),
      });
      const elapsed = computeEffectiveElapsed(plot, getWaterSpeedup() ?? WATER_SPEEDUP);

      if (elapsed >= growMs) {
        plot.state = 'ready';
        changed    = true;
        if (!notifiedPlots.has(i)) {
          notifiedPlots.add(i);
          if (settings.vibrate && navigator.vibrate) navigator.vibrate([50, 30, 50]);
        }
      }
      renderPlot(i);
    } else {
      notifiedPlots.delete(i);
    }
  });

  if (changed) { saveState(); updateShopUI(); }
}

// ── MODAL / RESET ─────────────────────────────────────────
function confirmReset() { el('reset-modal').classList.add('open'); }
function closeModal()   { el('reset-modal').classList.remove('open'); }

function doReset() {
  clearState();
  // Reset all fields in-place (keeps the same object reference)
  Object.assign(state, {
    coins: 0, lifetimeCoins: 0,
    wheatSeeds: 5, cornSeeds: 0, pumpkinSeeds: 0, truffleSeeds: 0,
    water: 0, fertilizer: 0, glovesDurability: 0,
    wheat: 0, corn: 0, pumpkin: 0, truffle: 0,
    barnLevel: 0, rows: 2, cols: 2, rowExpands: 0, colExpands: 0,
    plots: [],
    weather: { current: 'clear', changedAt: Date.now(), lastRainAt: 0, lastThunderAt: 0, floodedRow: -1 },
    unlockedAchievements: [],
    stats: {
      totalHarvests: 0, wheatHarvests: 0, totalWatered: 0, totalFertilized: 0,
      sellActions: 0, cropsLostToWeather: 0, rainWateredPlots: 0,
      thunderSurvived: 0, floodSurvived: 0, glovesUses: 0,
      truffleHarvests: 0, weatherCounts: {},
      everBoughtWater: false, everBoughtFert: false,
    },
    begTaps: 0,
    npcs: {},
    unlockedNpcs: ['kimchi'],
  });
  selectedCrop = 'wheat';
  selectedTool = 'plant';
  migrateNpcs();
  initPlots();
  saveState();
  renderGrid();
  updateHeader();
  updateShopUI();
  updateFarmToolbar(selectedCrop, selectedTool);
  updateWeatherBanner();
  updateHint();
  updateBegZone();
  updateTownVisibility();
  updateTownBadge();
  updateMerchantUI();
  closeModal();
  toast('🌱 Farm reset! Starting fresh.');
}

// ── SAVE / LOAD ───────────────────────────────────────────
function downloadSave() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `cozyfarm-save-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('💾 Save downloaded!');
}

function uploadSave(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      // Basic validation: must have coins and plots
      if (typeof parsed.coins !== 'number' || !Array.isArray(parsed.plots)) {
        toast('❌ Invalid save file.');
        return;
      }
      Object.assign(state, parsed);
      migrateState();
      migrateNpcs();
      initPlots();
      saveState();
      renderGrid();
      updateHeader();
      updateShopUI();
      updateFarmToolbar(selectedCrop, selectedTool);
      updateWeatherBanner();
      updateHint();
      updateBegZone();
      updateTownVisibility();
      updateTownBadge();
      updateMerchantUI();
      checkAchievements();
      toast('✅ Save loaded! Welcome back.');
    } catch (err) {
      toast('❌ Could not read save file.');
    }
  };
  reader.readAsText(file);
}

// ── EVENT DELEGATION ──────────────────────────────────────
// Replaces inline onclick="" on every element in HTML.
// One listener on <main> handles all game-action clicks.
function wireEvents() {
  // Plot clicks (fired via custom event from ui.js renderGrid)
  document.getElementById('farm-grid').addEventListener('plot-click', e => {
    clickPlot(e.detail.idx);
  });

  // Deliver buttons in town tab (use data-deliver attribute)
  document.getElementById('npc-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-deliver]');
    if (btn) npcDeliver(btn.dataset.deliver);
  });

  // Tab bar
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab, btn));
  });

  // Toolbar — crop & tool buttons
  document.getElementById('crop-btn-wheat').addEventListener('click',   () => selectCrop('wheat'));
  document.getElementById('crop-btn-corn').addEventListener('click',    () => selectCrop('corn'));
  document.getElementById('crop-btn-pumpkin').addEventListener('click', () => selectCrop('pumpkin'));
  document.getElementById('crop-btn-truffle').addEventListener('click', () => selectCrop('truffle'));
  document.getElementById('tool-btn-water').addEventListener('click',   () => selectTool('water'));
  document.getElementById('tool-btn-fert').addEventListener('click',    () => selectTool('fert'));

  // Shop — sell
  document.getElementById('sell-all-crops-btn').addEventListener('click', () => sellAllCrops());
  document.getElementById('sell-wheat-all-btn').addEventListener('click', () => sellCrop('wheat', 'all'));
  document.getElementById('sell-wheat1-btn').addEventListener('click',    () => sellCrop('wheat', 1));
  document.getElementById('sell-corn-all-btn').addEventListener('click',  () => sellCrop('corn', 'all'));
  document.getElementById('sell-corn1-btn').addEventListener('click',     () => sellCrop('corn', 1));
  document.getElementById('sell-pumpkin-all-btn').addEventListener('click', () => sellCrop('pumpkin', 'all'));
  document.getElementById('sell-pumpkin1-btn').addEventListener('click',    () => sellCrop('pumpkin', 1));
  document.getElementById('sell-truffle-all-btn').addEventListener('click', () => sellCrop('truffle', 'all'));
  document.getElementById('sell-truffle1-btn').addEventListener('click',    () => sellCrop('truffle', 1));

  // Shop — buy seeds
  document.getElementById('buy-wheat1-btn').addEventListener('click',    () => buySeeds('wheat', 1));
  document.getElementById('buy-wheat10-btn').addEventListener('click',   () => buySeeds('wheat', 10));
  document.getElementById('buy-corn1-btn').addEventListener('click',     () => buySeeds('corn', 1));
  document.getElementById('buy-corn5-btn').addEventListener('click',     () => buySeeds('corn', 5));
  document.getElementById('buy-pumpkin1-btn').addEventListener('click',  () => buySeeds('pumpkin', 1));
  document.getElementById('buy-pumpkin3-btn').addEventListener('click',  () => buySeeds('pumpkin', 3));
  document.getElementById('buy-truffle1-btn').addEventListener('click',  () => buySeeds('truffle', 1));
  document.getElementById('buy-truffle3-btn').addEventListener('click',  () => buySeeds('truffle', 3));

  // Shop — supplies
  document.getElementById('buy-water1-btn').addEventListener('click',  () => buyWater(1));
  document.getElementById('buy-water5-btn').addEventListener('click',  () => buyWater(5));
  document.getElementById('buy-hose-btn').addEventListener('click',    () => buyWaterHose());
  document.getElementById('buy-fert1-btn').addEventListener('click',   () => buyFertilizer(1));
  document.getElementById('buy-fert5-btn').addEventListener('click',   () => buyFertilizer(5));
  document.getElementById('buy-bigfert-btn').addEventListener('click', () => buyBigFertilizer());
  document.getElementById('buy-gloves-btn').addEventListener('click',  () => buyGloves());

  // Shop — barn & farm
  document.getElementById('barn-upgrade-btn').addEventListener('click', () => upgradeBarn());
  document.getElementById('row-btn').addEventListener('click',          () => expandGrid('row'));
  document.getElementById('col-btn').addEventListener('click',          () => expandGrid('col'));

  // Beg button
  document.getElementById('beg-btn').addEventListener('click', () => begForSeeds());

  // Settings — theme toggle
  document.getElementById('setting-dark').addEventListener('change', function () {
    saveSetting('dark', this.checked);
    applyTheme();
  });
  document.getElementById('setting-vibrate').addEventListener('change', function () {
    saveSetting('vibrate', this.checked);
  });

  // Reset modal
  document.querySelector('[data-action="confirm-reset"]').addEventListener('click', confirmReset);
  document.querySelector('[data-action="close-modal"]').addEventListener('click',   closeModal);
  document.querySelector('[data-action="do-reset"]').addEventListener('click',      doReset);

  // Save / Load
  document.getElementById('download-save-btn').addEventListener('click', downloadSave);
  document.getElementById('upload-save-input').addEventListener('change', function() {
    uploadSave(this.files[0]);
    this.value = ''; // reset so same file can be re-uploaded
  });

  // Merchant icons → open modal
  document.getElementById('merchant-mochi').addEventListener('click', () => openMerchantModal('mochi'));
  document.getElementById('merchant-moto').addEventListener('click',  () => openMerchantModal('moto'));

  // Merchant modal buttons
  document.getElementById('merchant-dismiss-btn').addEventListener('click', () => {
    el('merchant-modal').classList.remove('open');
    dismissMerchant();
  });
  document.getElementById('merchant-decline-btn').addEventListener('click', () => {
    el('merchant-modal').classList.remove('open');
    declineMerchant();
  });
  document.getElementById('merchant-modal-close').addEventListener('click', () => {
    el('merchant-modal').classList.remove('open');
    dismissMerchant();
  });

  // Moto outcome modal dismiss
  document.getElementById('moto-outcome-close').addEventListener('click', () => {
    import('./merchants.js').then(({ clearMotoOutcome }) => clearMotoOutcome());
  });
}

// ── INIT ──────────────────────────────────────────────────
function init() {
  loadSettings();
  loadState();
  migrateState();

  applyTheme();

  el('setting-dark').checked    = settings.dark;
  el('setting-vibrate').checked = settings.vibrate;

  // Catch up crops that grew while the page was closed.
  // Use the same shared helpers as the live tick loop so all NPC and weather
  // bonuses are respected — even on cold start.
  const catchUpWeatherMult = currentWeatherMultiplier();
  const catchUpWeather     = (state.weather && state.weather.current) || 'clear';
  const catchUpBadWeather  = ['rain', 'thunder', 'flood'].includes(catchUpWeather);
  state.plots.forEach(plot => {
    if (plot.state === 'planted') {
      const cropKey = plot.crop || 'wheat';
      const growMs  = computeGrowMs(cropKey, catchUpWeatherMult, catchUpBadWeather, {
        truffleGrowMult:    getTruffleGrowMult(),
        cornGrowMult:       getCornGrowMult(),
        pumpkinWeatherMult: getPumpkinWeatherMult(),
        kalbiL5:            affinityLevelFor('kalbi') >= 5,
        photosynthActive:   isPhotosynthActive(),
      });
      const elapsed = computeEffectiveElapsed(plot, getWaterSpeedup() ?? WATER_SPEEDUP);
      if (elapsed >= growMs) plot.state = 'ready';
    }
  });

  migrateNpcs();
  initPlots();
  wireEvents();
  renderGrid();
  updateHeader();
  updateShopUI();
  updateFarmToolbar(selectedCrop, selectedTool);
  updateHint();
  updateBegZone();
  updateTownVisibility();
  updateTownBadge();
  updateWeatherBanner();
  updateMerchantUI();
  checkAchievements();

  setInterval(tick, 1000);
}

init();
