// ── CONSTANTS ─────────────────────────────────────────────

export const WEATHER_TYPES = {
  clear:    { id:'clear',    icon:'🌤️',  name:'Clear',        desc:'No special effects',          cls:'',        weight:35 },
  sunny:    { id:'sunny',    icon:'☀️',   name:'Sunny',        desc:'Crops grow 20% faster',       cls:'sunny',   weight:25 },
  overcast: { id:'overcast', icon:'☁️',   name:'Overcast',     desc:'Crops grow 20% slower',       cls:'overcast',weight:20 },
  rain:     { id:'rain',     icon:'🌧️',  name:'Rain',         desc:'Plots watered every 5 mins!', cls:'rain',    weight:12 },
  thunder:  { id:'thunder',  icon:'⛈️',  name:'Thunderstorm', desc:'Zaps 1–5 crops every 5 mins!',cls:'thunder', weight:6  },
  flood:    { id:'flood',    icon:'🌊',   name:'Flood',        desc:'One row flooded for the hour!',cls:'flood',   weight:2  },
};

export const WEATHER_DURATION_MS  = 60 * 60 * 1000; // 1 hour
export const SUNNY_SPEEDUP        = 0.80;
export const OVERCAST_SLOWDOWN    = 1.20;

export const CROPS = {
  wheat: {
    emoji: '🌾', seedling: '🌱', name: 'Wheat',
    growMs: 2 * 60 * 1000,
    seedCost: 5, sellPrice: 10, yield: 1,
  },
  corn: {
    emoji: '🌽', seedling: '🪴', name: 'Corn',
    growMs: 8 * 60 * 1000,
    seedCost: 15, sellPrice: 40, yield: 1,
    unlockCoins: 200,
  },
  pumpkin: {
    emoji: '🎃', seedling: '🌿', name: 'Pumpkin',
    growMs: 15 * 60 * 1000,
    seedCost: 25, sellPrice: 80, yield: 1,
    unlockCoins: 500,
  },
  truffle: {
    emoji: '🍄', seedling: '🟤', name: 'Truffle',
    growMs: 45 * 60 * 1000,
    seedCost: 50, sellPrice: 220, yield: 1,
    unlockCoins: 1500,
  },
};

export const ACHIEVEMENTS = [
  { id:'first_harvest',   icon:'🌾', name:'First Harvest',   desc:'Harvest your first crop',          check: s => (s.stats.totalHarvests||0) >= 1 },
  { id:'harvest_10',      icon:'🧺', name:'Busy Hands',      desc:'Harvest 10 crops total',           check: s => (s.stats.totalHarvests||0) >= 10 },
  { id:'harvest_100',     icon:'🏆', name:'Century Farmer',  desc:'Harvest 100 crops total',          check: s => (s.stats.totalHarvests||0) >= 100 },
  { id:'harvest_10000',   icon:'🌾', name:'Legendary Farmer', desc:'Harvest 10,000 crops total',        check: s => (s.stats.totalHarvests||0) >= 10000 },
  { id:'earn_100',        icon:'🪙', name:'Pocket Change',   desc:'Earn 100 coins lifetime',          check: s => (s.lifetimeCoins||0) >= 100 },
  { id:'earn_1000',       icon:'💰', name:'Golden Harvest',  desc:'Earn 1,000 coins lifetime',        check: s => (s.lifetimeCoins||0) >= 1000 },
  { id:'earn_10000',      icon:'🤑', name:'Truffle Tycoon',    desc:'Earn 10,000 coins lifetime',         check: s => (s.lifetimeCoins||0) >= 10000 },
  { id:'earn_100000',     icon:'🏅', name:'High Roller',       desc:'Earn 100,000 coins lifetime',        check: s => (s.lifetimeCoins||0) >= 100000 },
  { id:'earn_500000',     icon:'💰', name:'Half-Millionaire',  desc:'Earn 500,000 coins lifetime',        check: s => (s.lifetimeCoins||0) >= 500000 },
  { id:'earn_1000000',    icon:'💎', name:'Millionaire',        desc:'Earn 1,000,000 coins lifetime',      check: s => (s.lifetimeCoins||0) >= 1000000 },
  { id:'earn_5000000',    icon:'👑', name:'Legendary Tycoon',  desc:'Earn 5,000,000 coins lifetime',      check: s => (s.lifetimeCoins||0) >= 5000000 },
  { id:'survive_thunder', icon:'⛈️', name:'Storm Survivor',  desc:'Survive a thunderstorm',           check: s => (s.stats.thunderSurvived||0) >= 1 },
  { id:'survive_flood',   icon:'🌊', name:'Flood Survivor',  desc:'Survive a flood',                  check: s => (s.stats.floodSurvived||0) >= 1 },
  { id:'rain_watered',    icon:'🌧️', name:'Free Water',      desc:'Have plots watered by rain',       check: s => (s.stats.rainWateredPlots||0) >= 1 },
  { id:'full_grid',       icon:'🏡', name:'Full House',      desc:'Fill every plot at once',          check: s => s.plots.length > 0 && s.plots.every(p=>p.state!=='empty') },
  { id:'gloves_uses',     icon:'🧤', name:'Green Thumb',     desc:'Use gloves 20 times',              check: s => (s.stats.glovesUses||0) >= 20 },
  { id:'truffle_harvest', icon:'🍄', name:'Truffle Hunter',  desc:'Harvest your first Truffle',       check: s => (s.stats.truffleHarvests||0) >= 1 },
  { id:'expand_max',      icon:'🗺️', name:'Land Baron',      desc:'Reach a 4×4 farm or larger',      check: s => s.rows >= 4 && s.cols >= 4 },
  { id:'lost_to_weather', icon:'💀', name:"Nature's Wrath",  desc:'Lose 5+ crops to weather',         check: s => (s.stats.cropsLostToWeather||0) >= 5 },
  { id:'sell_10_times',   icon:'🏪', name:'Market Regular',  desc:'Sell crops 10 times',              check: s => (s.stats.sellActions||0) >= 10 },
  { id:'watered_20',      icon:'💧', name:'Diligent Farmer', desc:'Water 20 individual plots',        check: s => (s.stats.totalWatered||0) >= 20 },
];

export const WATER_COST      = 6;
export const WATER_HOSE_COST = 200;
export const WATER_SPEEDUP   = 1.35;
export const FERT_COST       = 8;
export const BIG_FERT_COST   = 280;
export const FERT_YIELD      = 2;
export const GLOVES_COST     = 80;
export const GLOVES_USES     = 20;
export const GLOVES_CHANCE   = 0.60;

export const BARN_BASE_CAP = 20;
export const BARN_UPGRADES = [
  { cap: 40,  cost: 60   },
  { cap: 60,  cost: 150  },
  { cap: 100, cost: 350  },
  { cap: 150, cost: 2500 },
  { cap: 200, cost: 8000 },
];

export const EXPAND_BASE = 50;
export const EXPAND_MULT = 2.5;
export const MAX_ROWS    = 6;
export const MAX_COLS    = 6;

// ── STATE ─────────────────────────────────────────────────
// Single mutable object — mutated in-place by all modules.
// Import by reference: `import { state } from './state.js'`

export const state = {
  coins: 0,
  lifetimeCoins: 0,
  wheatSeeds: 5, cornSeeds: 0, pumpkinSeeds: 0, truffleSeeds: 0,
  water: 0, fertilizer: 0,
  glovesDurability: 0,
  wheat: 0, corn: 0, pumpkin: 0, truffle: 0,
  barnLevel: 0,
  rows: 2, cols: 2,
  rowExpands: 0, colExpands: 0,
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
  merchant: {
    active: null,        // null | 'mochi' | 'moto'
    arrivedAt: 0,        // when current merchant arrived
    nextVisitAt: 0,      // when next visit can begin
    nextMerchant: null,  // forced next merchant after decline/auto-dismiss
    effect: null,        // active effect object
    motoOutcome: null,   // revealed after Moto purchase
    activeItemId: null,  // which Mochi item is offered this visit
    activeRiddleId: null,// which Moto riddle is offered this visit
  },
};

// settings lives separately from game state (different localStorage key)
export const settings = {
  dark: true,
  vibrate: false,
};

// ── PERSISTENCE ───────────────────────────────────────────
// Keys are identical to the original single-file version — no save-data loss.

const STATE_KEY    = 'cozyfarm_state';
const SETTINGS_KEY = 'cozyfarm_settings';

export function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function loadState() {
  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
  } catch (e) { /* corrupt save — start fresh */ }
}

export function saveSetting(key, val) {
  settings[key] = val;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;
  try { Object.assign(settings, JSON.parse(raw)); } catch (e) {}
}

export function clearState() {
  localStorage.removeItem(STATE_KEY);
}

// ── HELPERS ───────────────────────────────────────────────

export function barnCap() {
  if (state.barnLevel <= 0) return BARN_BASE_CAP;
  return BARN_UPGRADES[state.barnLevel - 1].cap;
}

export function totalBarnContents() {
  return (state.wheat || 0) + (state.corn || 0) + (state.pumpkin || 0) + (state.truffle || 0);
}

export function expandCost(type) {
  const n = type === 'row' ? state.rowExpands : state.colExpands;
  return Math.round(EXPAND_BASE * Math.pow(EXPAND_MULT, n));
}

export function initPlots() {
  const needed = state.rows * state.cols;
  while (state.plots.length < needed) {
    state.plots.push({ state: 'empty', crop: null, plantedAt: null, watered: false, fertilized: false });
  }
  state.plots = state.plots.slice(0, needed);
}

export function currentWeatherMultiplier() {
  const w = (state.weather && state.weather.current) || 'clear';
  if (w === 'sunny')    return SUNNY_SPEEDUP;
  if (w === 'overcast') return OVERCAST_SLOWDOWN;
  return 1.0;
}

export function pickWeather() {
  const pool = [];
  Object.values(WEATHER_TYPES).forEach(w => {
    for (let i = 0; i < w.weight; i++) pool.push(w.id);
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

export function formatTime(secs) {
  if (secs <= 0) return '0s';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m${s > 0 ? s + 's' : ''}` : `${s}s`;
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Migrate any old save-data field names forward. */
export function migrateState() {
  if (state.seeds !== undefined && state.wheatSeeds === undefined) {
    state.wheatSeeds = state.seeds;
    delete state.seeds;
  }
  if (!state.wheatSeeds)        state.wheatSeeds        = 5;
  if (!state.cornSeeds)         state.cornSeeds         = 0;
  if (!state.pumpkinSeeds)      state.pumpkinSeeds      = 0;
  if (!state.truffleSeeds)      state.truffleSeeds      = 0;
  if (!state.water)             state.water             = 0;
  if (!state.fertilizer)        state.fertilizer        = 0;
  if (!state.glovesDurability)  state.glovesDurability  = 0;
  if (!state.wheat)             state.wheat             = 0;
  if (!state.corn)              state.corn              = 0;
  if (!state.pumpkin)           state.pumpkin           = 0;
  if (!state.truffle)           state.truffle           = 0;
  if (!state.barnLevel)         state.barnLevel         = 0;
  if (!state.lifetimeCoins)     state.lifetimeCoins     = 0;
  if (!state.weather)           state.weather           = { current: 'clear', changedAt: Date.now(), lastRainAt: 0, lastThunderAt: 0, floodedRow: -1 };
  if (state.weather.lastRainAt    === undefined) state.weather.lastRainAt    = 0;
  if (state.weather.lastThunderAt === undefined) state.weather.lastThunderAt = 0;
  if (state.weather.floodedRow    === undefined) state.weather.floodedRow    = -1;
  if (!state.unlockedAchievements) state.unlockedAchievements = [];
  if (!state.stats)             state.stats             = {};
  if (!state.stats.weatherCounts)  state.stats.weatherCounts  = {};
  if (state.stats.wheatHarvests  === undefined) state.stats.wheatHarvests  = 0;
  if (state.stats.everBoughtWater === undefined) state.stats.everBoughtWater = false;
  if (state.stats.everBoughtFert  === undefined) state.stats.everBoughtFert  = false;
  if (state.begTaps === undefined) state.begTaps = 0;
  // Migrate old plot format
  state.plots.forEach(p => {
    if (!p.crop) p.crop = 'wheat';
    if (p.watered   === undefined) p.watered   = false;
    if (p.fertilized === undefined) p.fertilized = false;
  });
  // Migrate merchant state
  if (!state.merchant) state.merchant = { active: null, arrivedAt: 0, nextVisitAt: 0, nextMerchant: null, effect: null, motoOutcome: null, activeItemId: null, activeRiddleId: null };
  if (state.merchant.motoOutcome    === undefined) state.merchant.motoOutcome    = null;
  if (state.merchant.activeItemId   === undefined) state.merchant.activeItemId   = null;
  if (state.merchant.activeRiddleId === undefined) state.merchant.activeRiddleId = null;
}
