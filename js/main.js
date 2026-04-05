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
} from './state.js';

import {
  migrateNpcs, tickNpcs, deliverRequest as npcDeliver,
  NPC_ORDER,
  getGlovesUses, getGlovesChance,
  getWheatSellMult, getWheatYieldBonus, getWheatWeatherImmune,
  getTruffleSellPrice, getTruffleGrowMult, getTruffleMinYield,
  getCornYieldBonus, getCornSellMult, getCornGrowMult,
  getPumpkinSellMult, getPumpkinWeatherMult,
  getWaterSpeedup, getWaterHoseCost, getWaterHoseAreaBoost,
  getFertYield, getBigFertCost, getBigFertYield, getFertInstantChance,
} from './npcs.js';

import {
  el, toast, applyTheme, switchTab,
  renderGrid, renderPlot, updateHeader, updateFarmToolbar,
  updateHint, updateBegZone, updateShopUI,
  updateWeatherBanner, updateTownVisibility, updateTownBadge,
  renderTownTab, tickTownCooldowns, renderLogTab,
} from './ui.js';

// ── INTERACTION STATE ─────────────────────────────────────
let selectedCrop = 'wheat';
let selectedTool = 'plant'; // 'plant' | 'water' | 'fert'
let notifiedPlots = new Set();

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

// ── PLOT INTERACTIONS ─────────────────────────────────────
function clickPlot(idx) {
  const plot = state.plots[idx];

  if (selectedTool === 'water') {
    if (plot.state === 'ready') { harvestPlot(idx); return; }
    if (plot.state !== 'planted') { toast('Plant a crop first!'); return; }
    if (plot.watered) { toast('Already watered!'); return; }
    if ((state.water || 0) < 1) { toast('No water! Buy some in the Shop.'); return; }
    state.water--;
    plot.watered = true;
    state.stats.totalWatered = (state.stats.totalWatered || 0) + 1;
    saveState();
    renderPlot(idx);
    updateHeader();
    updateShopUI();
    updateFarmToolbar(selectedCrop, selectedTool);
    toast('💧 Watered! Growing faster.');
    checkAchievements();
    return;
  }

  if (selectedTool === 'fert') {
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
  const plot         = state.plots[idx];
  const crop         = CROPS[plot.crop];
  const elapsed      = Date.now() - plot.plantedAt;
  const weatherMult  = currentWeatherMultiplier();
  const baseGrowMs   = plot.watered ? crop.growMs * (getWaterSpeedup() ?? WATER_SPEEDUP) : crop.growMs;
  const growMs       = baseGrowMs * weatherMult;
  const remaining    = Math.max(0, Math.ceil((growMs - elapsed) / 1000));

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
  const plot    = state.plots[idx];
  const crop    = CROPS[plot.crop || 'wheat'];
  const cropKey = plot.crop || 'wheat';

  let yieldAmt = crop.yield;

  // Kola: enhanced fertilizer yield
  if (plot.fertilized) {
    const fertBonus = getFertYield();
    yieldAmt += (fertBonus !== null ? fertBonus : FERT_YIELD);
  }

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

  const space = barnCap() - totalBarnContents();
  if (space <= 0) { toast('🏚️ Barn full! Sell some crops first.'); return; }

  // Partial harvest: take only what fits, leave the plot as ready if there's more
  const partialHarvest = yieldAmt > space;
  const actualHarvest = Math.min(yieldAmt, space);
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
  const glovesChance  = getGlovesChance() !== null ? getGlovesChance() : GLOVES_CHANCE;
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
    state.plots.forEach(p => { if (p.state === 'planted') p.watered = true; });
    const wetted = state.plots.filter(p => p.state === 'planted' && p.watered).length;
    saveState(); renderGrid(); updateHeader(); updateShopUI();
    toast(`💧✨ Torrent! All ${wetted} plots soaked${cost === 0 ? ' (free!)' : ''}!`);
  } else {
    targets.forEach(p => { p.watered = true; });
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
function applyWeatherEffects(newWeatherId) {
  if (!state.stats.weatherCounts) state.stats.weatherCounts = {};
  state.stats.weatherCounts[newWeatherId] = (state.stats.weatherCounts[newWeatherId] || 0) + 1;

  if (newWeatherId === 'rain') {
    let count = 0;
    state.plots.forEach(p => {
      if (p.state === 'planted' && !p.watered) { p.watered = true; count++; }
    });
    if (count > 0) {
      state.stats.rainWateredPlots = (state.stats.rainWateredPlots || 0) + count;
      toast(`🌧️ Rain! ${count} plot${count > 1 ? 's' : ''} watered for free!`);
      renderGrid(); checkAchievements();
    } else {
      toast("🌧️ It's raining! (All plots already watered)");
    }

  } else if (newWeatherId === 'thunder') {
    // Kalbi L5: wheat is immune to weather destruction
    const wheatImmune = getWheatWeatherImmune();
    const occupied = state.plots.map((p, i) => ({ p, i })).filter(({ p }) => p.state !== 'empty' && !(wheatImmune && p.crop === 'wheat'));
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
      const immuneMsg = wheatImmune ? ' (Wheat protected by Kalbi!)' : '';
      toast(`⛈️ Thunderstorm! ${zapCount} crop${zapCount > 1 ? 's were' : ' was'} zapped! 💀${immuneMsg}`);
      renderGrid(); checkAchievements();
    } else {
      state.stats.thunderSurvived = (state.stats.thunderSurvived || 0) + 1;
      toast('⛈️ Thunderstorm! (Nothing to zap this time)');
      checkAchievements();
    }

  } else if (newWeatherId === 'flood') {
    const wheatImmune = getWheatWeatherImmune();
    const occupiedRows = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const idx = r * state.cols + c;
        const p = state.plots[idx];
        if (p && p.state !== 'empty' && !(wheatImmune && p.crop === 'wheat') && !occupiedRows.includes(r)) {
          occupiedRows.push(r);
        }
      }
    }
    if (occupiedRows.length > 0) {
      const row = occupiedRows[Math.floor(Math.random() * occupiedRows.length)];
      let lost  = 0;
      for (let c = 0; c < state.cols; c++) {
        const idx = row * state.cols + c;
        const p = state.plots[idx];
        if (p && p.state !== 'empty' && !(wheatImmune && p.crop === 'wheat')) {
          state.plots[idx] = { state:'empty', crop:null, plantedAt:null, watered:false, fertilized:false };
          notifiedPlots.delete(idx);
          lost++;
        }
      }
      state.stats.cropsLostToWeather = (state.stats.cropsLostToWeather || 0) + lost;
      state.stats.floodSurvived      = (state.stats.floodSurvived      || 0) + 1;
      const immuneMsg = wheatImmune ? " (Wheat survived — Kalbi's blessing!)" : '';
      toast(`🌊 Flood! Row ${row + 1} hit! (${lost} crop${lost > 1 ? 's' : ''} lost)${immuneMsg}`);
      renderGrid(); checkAchievements();
    } else {
      state.stats.floodSurvived = (state.stats.floodSurvived || 0) + 1;
      toast('🌊 Flood! (No crops to destroy this time)');
      checkAchievements();
    }

  } else if (newWeatherId === 'sunny')    { toast('☀️ Sunny! Crops are growing 20% faster.');
  } else if (newWeatherId === 'overcast') { toast('☁️ Overcast. Crops are growing 20% slower.');
  } else                                   { toast('🌤️ Skies have cleared up.');
  }
}

function tickWeather() {
  if (!state.weather) state.weather = { current: 'clear', changedAt: Date.now() };
  const elapsed = Date.now() - state.weather.changedAt;
  if (elapsed >= WEATHER_DURATION_MS) {
    const newW = pickWeather();
    state.weather.current   = newW;
    state.weather.changedAt = Date.now();
    saveState();
    applyWeatherEffects(newW);
  }
  updateWeatherBanner();
}

// ── TICK LOOP ─────────────────────────────────────────────
function tick() {
  tickWeather();
  tickNpcs();
  tickTownCooldowns();

  const weatherMult = currentWeatherMultiplier();
  const currentWeather = (state.weather && state.weather.current) || 'clear';
  const isBadWeather = ['rain', 'thunder', 'flood'].includes(currentWeather);
  let changed = false;

  state.plots.forEach((plot, i) => {
    if (plot.state === 'planted') {
      const crop = CROPS[plot.crop || 'wheat'];
      const waterMult = plot.watered ? (getWaterSpeedup() ?? WATER_SPEEDUP) : 1.0;
      let growMs = crop.growMs * waterMult;

      // Crop-specific grow bonuses
      if (plot.crop === 'truffle') growMs *= getTruffleGrowMult();
      if (plot.crop === 'corn')    growMs *= getCornGrowMult();
      if (plot.crop === 'pumpkin' && isBadWeather) growMs *= getPumpkinWeatherMult();
      if (plot.crop === 'wheat' && affinityLevelFor('kalbi') >= 5) growMs *= 0.50;

      growMs *= weatherMult;

      if (Date.now() - plot.plantedAt >= growMs) {
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
    weather: { current: 'clear', changedAt: Date.now() },
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
  closeModal();
  toast('🌱 Farm reset! Starting fresh.');
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
}

// ── INIT ──────────────────────────────────────────────────
function init() {
  loadSettings();
  loadState();
  migrateState();

  applyTheme();

  el('setting-dark').checked    = settings.dark;
  el('setting-vibrate').checked = settings.vibrate;

  // Catch up crops that grew while the page was closed
  state.plots.forEach(plot => {
    if (plot.state === 'planted') {
      const crop   = CROPS[plot.crop || 'wheat'];
      const waterMult = plot.watered ? (getWaterSpeedup() ?? WATER_SPEEDUP) : 1.0;
      const growMs = crop.growMs * waterMult;
      if (Date.now() - plot.plantedAt >= growMs) plot.state = 'ready';
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
  checkAchievements();

  setInterval(tick, 1000);
}

init();
