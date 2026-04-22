// ── LOGIC MODULE ──────────────────────────────────────────
// Single source of truth for all game math / formulas.
// Imported by ui.js, main.js, npcs.js, and banquet.js.
// Eliminates the duplicate local-function pattern that was
// living inside ui.js to work around circular imports.

import { state, CROPS, WATER_SPEEDUP } from './state.js';

// ── NPC LEVEL HELPER ──────────────────────────────────────
export function npcLevel(id) {
  return Math.min(5, Math.floor(((state.npcs && state.npcs[id] && state.npcs[id].affinity) || 0) / 3));
}

// ── SELL PRICES (with NPC bonuses applied) ────────────────
export function wheatSellPrice() {
  const l = npcLevel('kalbi');
  return l >= 3 ? 13 : l >= 1 ? 11 : 10;
}
export function cornSellPrice() {
  const l = npcLevel('twins');
  return l >= 3 ? 52 : l >= 1 ? 46 : 40;
}
export function pumpkinSellPrice() {
  const l = npcLevel('maru');
  return l >= 3 ? 112 : l >= 1 ? 92 : 80;
}
export function truffleSellPrice() {
  const l = npcLevel('ellie');
  return l >= 5 ? Math.round(220 * 2.20) : l >= 3 ? 275 : l >= 1 ? 242 : 220;
}

// ── WATER / SPEEDUP ───────────────────────────────────────
export function waterSpeedupPct() {
  const l = npcLevel('cinna');
  return l >= 5 ? 70 : l >= 3 ? 60 : l >= 1 ? 45 : 35;
}
export function hoseCost() {
  const l = npcLevel('cinna');
  return l >= 2 ? 140 : 200;
}
/** Returns the water-time divisor (lower = faster). */
export function waterSpeedupFactor() {
  const l = npcLevel('cinna');
  return l >= 5 ? 0.30 : l >= 3 ? 0.40 : l >= 1 ? 0.55 : 0.65;
}

// ── FERTILIZER ────────────────────────────────────────────
export function fertYieldAmt() {
  const l = npcLevel('kola');
  return l >= 3 ? 5 : l >= 1 ? 3 : 2;
}
export function bigFertCost() {
  const l = npcLevel('kola');
  return l >= 2 ? 190 : 280;
}
export function bigFertYieldAmt() {
  const l = npcLevel('kola');
  return l >= 3 ? 5 : l >= 1 ? 3 : 2;
}

// ── GLOVES ────────────────────────────────────────────────
export function glovesMaxUses() {
  const l = npcLevel('kimchi');
  return l >= 5 ? Infinity : l >= 4 ? 60 : l >= 3 ? 50 : l >= 2 ? 40 : l >= 1 ? 30 : 20;
}
export function glovesChancePct() {
  return npcLevel('kimchi') >= 5 ? 80 : 60;
}

// ── TOWN PRIDE ────────────────────────────────────────────
export function prideLevelFromPoints(pts) {
  return Math.min(5, Math.floor((pts || 0) / 3));
}

/**
 * Returns { chance, bonus } for the Golden Yield perk at the given pride level.
 * chance = 0 means perk is inactive.
 */
export function goldenYieldPerk(prideLevel) {
  if (prideLevel <= 0) return { chance: 0, bonus: 0 };
  if (prideLevel === 1) return { chance: 0.05, bonus: 5 };
  if (prideLevel === 2) return { chance: 0.05, bonus: 10 };
  if (prideLevel === 3) return { chance: 0.10, bonus: 10 };
  if (prideLevel === 4) return { chance: 0.25, bonus: 10 };
  // Level 5: instant grow on plant handled separately; harvest bonus same as L4+
  return { chance: 0.25, bonus: 10 };
}

/** Returns true if Pride Level 5's instant-grow perk should fire. */
export function rollPrideInstantGrow() {
  return prideLevelFromPoints(state.pridePoints || 0) >= 5 && Math.random() < 0.25;
}

// ── GROW DURATION ─────────────────────────────────────────
export function computeGrowMs(cropKey, weatherMult, isBadWeather, opts = {}) {
  const crop = CROPS[cropKey] || CROPS.wheat;
  let growMs = crop.growMs;

  if (cropKey === 'truffle' && opts.truffleGrowMult != null) growMs *= opts.truffleGrowMult;
  if (cropKey === 'corn'    && opts.cornGrowMult    != null) growMs *= opts.cornGrowMult;
  if (cropKey === 'pumpkin' && isBadWeather && opts.pumpkinWeatherMult != null)
    growMs *= opts.pumpkinWeatherMult;
  if (cropKey === 'wheat'   && opts.kalbiL5) growMs *= 0.50;

  growMs = Math.max(crop.growMs * 0.30, growMs);

  const effWeather = (opts.photosynthActive && weatherMult > 1.0) ? 1.0 : weatherMult;
  growMs *= effWeather;

  return Math.max(10000, growMs);
}

/**
 * Compute effective elapsed grow-time for a plot, accounting for watering speedup.
 * @param {object} plot
 * @param {number} waterSpeedup  - time divisor, e.g. 0.65
 * @param {number} [nowOverride] - pin time (Frozen Soil)
 */
export function computeEffectiveElapsed(plot, waterSpeedup, nowOverride) {
  const speedup = waterSpeedup != null ? waterSpeedup : WATER_SPEEDUP;
  const now     = nowOverride != null ? nowOverride : Date.now();
  let elapsed   = now - (plot.plantedAt || now);
  if (plot.watered && plot.wateredAt) {
    const bw = Math.max(0, plot.wateredAt - plot.plantedAt);
    const aw = Math.max(0, now - plot.wateredAt);
    elapsed  = bw + aw / speedup;
  }
  return elapsed;
}
