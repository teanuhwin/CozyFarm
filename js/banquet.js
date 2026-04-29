// ── GRAND BANQUET MODULE ──────────────────────────────────
// Endgame system that activates when all 7 NPCs hit Lv.5 affinity.
// Flow:
//   1. Player pays Town Permit (50 000 🪙, scaled each run).
//   2. Player fills the Communal Pot incrementally (requirements scale per run).
//   3. Pot full → Harvest Rush mini-game.
//   4. Mini-game win → +1 Pride Point → Golden Yield perks.
// The banquet follows a 15-party seasonal cycle before looping.

import { state, saveState, randInt } from './state.js';
import { NPC_ORDER, NPC_DATA } from './npcs.js';
import { prideLevelFromPoints } from './logic.js';

// toast is imported dynamically to avoid a static circular dependency
// (ui.js imports from banquet.js at the top level for renderTownTab).
function toast(msg) {
  import('./ui.js').then(({ toast: t }) => t(msg));
}

// ── CONSTANTS ─────────────────────────────────────────────

export const PERMIT_BASE_COST = 50_000;
export const PERMIT_SCALE     = 25_000; // flat increment per completed run

// Base communal pot requirements (run 0). Scale up each completed run.
export const POT_BASE = [
  { cropKey: 'wheat',   qty: 80,  scale: 40  },
  { cropKey: 'corn',    qty: 60,  scale: 30  },
  { cropKey: 'pumpkin', qty: 40,  scale: 20  },
  { cropKey: 'truffle', qty: 20,  scale: 10  },
];

// Legacy export kept for any external consumers that imported the old flat array.
export const COMMUNAL_POT_REQUIREMENTS = POT_BASE;

export const HARVEST_RUSH_START_LEN = 5;
export const HARVEST_RUSH_MAX_LEN   = 10;
export const HARVEST_RUSH_TIMER_MS  = 45_000; // 45 seconds total

// ── 15-PARTY BANQUET SCHEDULE ─────────────────────────────
// Cycles: run index mod 15 determines the current party (0-indexed).
export const BANQUET_SCHEDULE = [
  {
    name:    'The Birthday Bash',
    emoji:   '🎂',
    hostId:  'kimchi',
    season:  'January',
    desc:    'A joint celebration for Kimchi and Kalbi — the whole town turns out!',
  },
  {
    name:    'The Deep Root Ritual',
    emoji:   '🌲',
    hostId:  'kalbi',
    season:  'Winter',
    desc:    "A solemn winter feast honoring the town's founders and old ways.",
  },
  {
    name:    'The February Thaw',
    emoji:   '🌱',
    hostId:  'cinna',
    season:  'Late Winter',
    desc:    'First sprouts of the year. Cinna brews a warming restoration tonic.',
  },
  {
    name:    'Spring Fashion Feast',
    emoji:   '🌸',
    hostId:  'ellie',
    season:  'March',
    desc:    'Cherry blossoms and silk. Ellie demands a dress code. No excuses.',
  },
  {
    name:    "The Hunter's Awakening",
    emoji:   '🐾',
    hostId:  'maru',
    season:  'April',
    desc:    'Spring wildlife returns. Maru emerges from the woods to celebrate.',
  },
  {
    name:    "Mochi's Merchant of Fortune",
    emoji:   '☀️',
    hostId:  'mochi',
    season:  'May',
    desc:    'Prosperity and reliable deals. Mochi guarantees something good.',
  },
  {
    name:    'The Solstice Stampede',
    emoji:   '⚡',
    hostId:  'twins',
    season:  'June',
    desc:    'High-speed chaos, corn on the cob, and things that may explode.',
  },
  {
    name:    "Moto's Midsummer Gamble",
    emoji:   '🌙',
    hostId:  'moto',
    season:  'July',
    desc:    'Casino vibes under a full moon. Lucky dice, unlucky consequences.',
  },
  {
    name:    'The August Star-Gazer',
    emoji:   '🌠',
    hostId:  'kola',
    season:  'August',
    desc:    'Peak summer meteor shower, cosmically aligned with crop growth.',
  },
  {
    name:    'The Autumn Equinox',
    emoji:   '🍂',
    hostId:  'kalbi',
    season:  'September',
    desc:    'Leaves turn gold, and so does the gratitude feast table.',
  },
  {
    name:    'The October Masquerade',
    emoji:   '🎭',
    hostId:  'kola',
    season:  'October',
    desc:    'Arcane, mysterious, and slightly alarming. Masks required.',
  },
  {
    name:    'The First Frost Ball',
    emoji:   '❄️',
    hostId:  'ellie',
    season:  'November',
    desc:    "One last triumph before deep freeze. Ellie's finest hour.",
  },
  {
    name:    'The Midnight Winter Watch',
    emoji:   '🏕️',
    hostId:  'maru',
    season:  'December',
    desc:    'Rugged outdoor feast. Maru insists on the woods. Bring a coat.',
  },
  {
    name:    "Moto's Holiday Shindig",
    emoji:   '🎁',
    hostId:  'moto',
    season:  'Holiday',
    desc:    'Lucky-dip gift exchange. Probability of disaster: moderate.',
  },
  {
    name:    'Prosperous New Year Party',
    emoji:   '🎆',
    hostId:  'mochi',
    season:  "New Year's",
    desc:    'Lucky envelopes, fireworks, and a countdown to new beginnings.',
  },
];

// Hosts that are merchants (not in NPC_DATA) — handled specially.
const MERCHANT_HOSTS = new Set(['mochi', 'moto']);

const CROP_KEYS = ['wheat', 'corn', 'pumpkin', 'truffle'];
const CROP_EMOJI_MAP = { wheat: '🌾', corn: '🌽', pumpkin: '🎃', truffle: '🍄' };

// ── HELPERS ───────────────────────────────────────────────

export function isEndgameActive() {
  if (!state.npcs) return false;
  return NPC_ORDER.every(id => (state.npcs[id]?.affinity || 0) >= 15);
}

export function permitCost() {
  const runs = state.banquet?.completedRuns || 0;
  return PERMIT_BASE_COST + runs * PERMIT_SCALE;
}

/** Returns the communal pot requirements for the current run (scaled). */
export function currentPotRequirements() {
  const runs = state.banquet?.completedRuns || 0;
  return POT_BASE.map(r => ({ cropKey: r.cropKey, qty: r.qty + runs * r.scale }));
}

/** Returns the party schedule entry for the current (upcoming) run. */
export function currentParty() {
  const runs = state.banquet?.completedRuns || 0;
  return BANQUET_SCHEDULE[runs % BANQUET_SCHEDULE.length];
}

export function migrateBanquet() {
  if (!state.banquet) {
    state.banquet = {
      phase: 'idle',           // 'idle' | 'pot' | 'rush' | 'complete'
      permitPaid: false,
      completedRuns: 0,
      pot: {},                 // { wheat: delivered, corn: delivered, … }
      rush: null,              // Harvest Rush runtime state
    };
  }
  const b = state.banquet;
  if (b.phase         === undefined) b.phase         = 'idle';
  if (b.permitPaid    === undefined) b.permitPaid    = false;
  if (b.completedRuns === undefined) b.completedRuns = 0;
  if (!b.pot)                         b.pot           = {};
  if (b.rush          === undefined)  b.rush          = null;
}

// ── PERMIT ────────────────────────────────────────────────

export function buyPermit() {
  migrateBanquet();
  const cost = permitCost();
  if (state.coins < cost) {
    toast(`Need 🪙${cost.toLocaleString()} for the Town Permit!`);
    return false;
  }
  state.coins -= cost;
  state.banquet.permitPaid = true;
  state.banquet.phase      = 'pot';

  // Reset the communal pot using scaled requirements for this run
  state.banquet.pot = {};
  currentPotRequirements().forEach(r => { state.banquet.pot[r.cropKey] = 0; });

  saveState();
  const party = currentParty();
  toast(`📜 Town Permit purchased! Fill the Communal Pot for ${party.name}!`);
  return true;
}

// ── COMMUNAL POT ──────────────────────────────────────────

export function deliverToPot(cropKey) {
  migrateBanquet();
  const b   = state.banquet;
  if (b.phase !== 'pot') return;

  const reqs = currentPotRequirements();
  const req  = reqs.find(r => r.cropKey === cropKey);
  if (!req) return;

  const delivered = b.pot[cropKey] || 0;
  const remaining = req.qty - delivered;
  if (remaining <= 0) { toast(`${CROP_EMOJI_MAP[cropKey]} Already fulfilled!`); return; }

  const have = state[cropKey] || 0;
  if (have <= 0) { toast(`No ${CROP_EMOJI_MAP[cropKey]} to deliver!`); return; }

  const amount = Math.min(have, remaining);
  state[cropKey]  -= amount;
  b.pot[cropKey]   = delivered + amount;

  saveState();
  toast(`${CROP_EMOJI_MAP[cropKey]} Delivered ${amount}! (${b.pot[cropKey]}/${req.qty})`);

  if (isPotFull()) {
    setTimeout(() => startHarvestRush(), 600);
  }

  return true;
}

export function isPotFull() {
  const b = state.banquet;
  if (!b || b.phase !== 'pot') return false;
  return currentPotRequirements().every(r => (b.pot[r.cropKey] || 0) >= r.qty);
}

export function potProgress() {
  const b = state.banquet;
  if (!b) return [];
  return currentPotRequirements().map(r => ({
    cropKey:   r.cropKey,
    emoji:     CROP_EMOJI_MAP[r.cropKey],
    required:  r.qty,
    delivered: b.pot[r.cropKey] || 0,
  }));
}

// ── HARVEST RUSH MINI-GAME ────────────────────────────────

function generatePattern(length) {
  const pattern = [];
  for (let i = 0; i < length; i++) {
    pattern.push(CROP_KEYS[randInt(0, CROP_KEYS.length - 1)]);
  }
  return pattern;
}

export function startHarvestRush() {
  migrateBanquet();
  const b = state.banquet;
  b.phase = 'rush';

  // Host comes from the schedule for this run
  const party  = currentParty();
  const hostId = party.hostId;

  b.rush = {
    hostId,
    stage:       1,
    pattern:     generatePattern(HARVEST_RUSH_START_LEN),
    playerInput: [],
    startedAt:   Date.now(),
    timerMs:     HARVEST_RUSH_TIMER_MS,
    failed:      false,
    complete:    false,
    failPending: false,
    lastFailure: null,
  };

  saveState();

  import('./ui.js').then(({ renderTownTab }) => renderTownTab());

  // Display correct host name whether NPC or merchant
  const hostName = MERCHANT_HOSTS.has(hostId)
    ? (hostId === 'mochi' ? 'Mochi ☀️' : 'Moto 🌙')
    : (NPC_DATA[hostId]?.name || hostId);
  toast(`🎉 Harvest Rush begins! ${hostName} is hosting!`);
}

/**
 * Called when the player taps a crop button during Harvest Rush.
 * Returns 'continue' | 'stage_clear' | 'win' | 'fail' | 'expired'.
 */
export function rushTap(cropKey) {
  migrateBanquet();
  const b = state.banquet;
  if (!b || b.phase !== 'rush' || !b.rush) return 'noop';

  const r = b.rush;

  // If a fail is pending acknowledgement, ignore crop taps
  if (r.failPending) return 'noop';

  // Check timer expiry
  if (Date.now() - r.startedAt > r.timerMs) {
    r.failed      = true;
    r.failPending = true;
    r.lastFailure = { wrongCrop: cropKey, expectedCrop: r.pattern[r.playerInput.length], reason: 'expired' };
    saveState();
    return 'expired';
  }

  const expectedCrop = r.pattern[r.playerInput.length];
  r.playerInput.push(cropKey);

  if (cropKey !== expectedCrop) {
    // Wrong tap — enter failPending state instead of immediately resetting
    r.failed      = true;
    r.failPending = true;
    r.lastFailure = { wrongCrop: cropKey, expectedCrop, reason: 'wrong' };
    saveState();
    return 'fail';
  }

  // Correct so far
  if (r.playerInput.length < r.pattern.length) {
    saveState();
    return 'continue';
  }

  // Stage cleared
  const maxStage = HARVEST_RUSH_MAX_LEN - HARVEST_RUSH_START_LEN + 1; // 6 stages
  if (r.stage >= maxStage) {
    r.complete = true;
    b.phase    = 'complete';
    saveState();
    setTimeout(() => finishBanquet(), 400);
    return 'win';
  }

  // Advance to next stage
  r.stage++;
  r.pattern     = generatePattern(HARVEST_RUSH_START_LEN - 1 + r.stage);
  r.playerInput = [];
  saveState();
  return 'stage_clear';
}

/**
 * Called when player taps "Got it!" after a rush failure.
 * Resets banquet back to pot phase so player can refill and try again.
 */
export function acknowledgeRushFail() {
  migrateBanquet();
  const b = state.banquet;
  if (!b || !b.rush || !b.rush.failPending) return;

  b.rush.failPending = false;
  b.phase = 'pot';
  // Reset pot deliveries so player must refill
  currentPotRequirements().forEach(r => { b.pot[r.cropKey] = 0; });
  b.rush = null;

  saveState();
}

// ── FINISH & REWARDS ──────────────────────────────────────

function finishBanquet() {
  const b = state.banquet;
  b.completedRuns = (b.completedRuns || 0) + 1;
  b.phase         = 'idle';
  b.permitPaid    = false;
  b.rush          = null;

  // Award Pride Point
  state.pridePoints = (state.pridePoints || 0) + 1;
  const newLevel    = prideLevelFromPoints(state.pridePoints);
  state.prideLevel  = newLevel;

  saveState();

  const levelMsg = newLevel <= 5 && (state.pridePoints % 3 === 0)
    ? ` ✨ Town Pride Level ${newLevel} reached!`
    : '';

  toast(`🎊 Banquet complete! +1 Pride Point (${state.pridePoints} total)!${levelMsg}`);

  import('./ui.js').then(({ renderTownTab, updateTownBadge }) => {
    renderTownTab();
    updateTownBadge();
  });
}

// ── RUSH TIMER TICK (called from main tick every second) ──

export function tickBanquet() {
  migrateBanquet();
  const b = state.banquet;
  if (b.phase !== 'rush' || !b.rush) return;

  // Skip timer expiry while a fail is pending acknowledgement
  if (b.rush.failPending) return;

  if (Date.now() - b.rush.startedAt > b.rush.timerMs) {
    // Enter failPending for timer expiry too — show Bodie screen
    b.rush.failed      = true;
    b.rush.failPending = true;
    b.rush.lastFailure = { wrongCrop: null, expectedCrop: b.rush.pattern[b.rush.playerInput.length], reason: 'expired' };
    saveState();
    import('./ui.js').then(({ renderTownTab }) => renderTownTab());
  }
}

/**
 * Called from the main tick every second while the Rush is active.
 * Updates only the timer display elements in-place — no full re-render.
 */
export function tickRushTimer() {
  const b = state.banquet;
  if (!b || b.phase !== 'rush' || !b.rush) return;

  // If fail is pending, freeze the timer bar at zero
  if (b.rush.failPending) {
    const textEl = document.getElementById('rush-timer-text');
    const barEl  = document.getElementById('rush-timer-bar');
    if (textEl) { textEl.textContent = '0s'; textEl.style.color = 'var(--red)'; }
    if (barEl)  { barEl.style.width = '0%'; barEl.style.background = 'var(--red)'; }
    return;
  }

  const elapsed   = Date.now() - b.rush.startedAt;
  const remaining = Math.max(0, Math.ceil((b.rush.timerMs - elapsed) / 1000));
  const pct       = Math.max(0, ((b.rush.timerMs - elapsed) / b.rush.timerMs) * 100);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timerStr   = `${mins > 0 ? mins + 'm ' : ''}${secs}s`;
  const timerColor = remaining < 20 ? 'var(--red)' : remaining < 60 ? 'var(--gold)' : 'var(--accent2)';

  const textEl = document.getElementById('rush-timer-text');
  const barEl  = document.getElementById('rush-timer-bar');
  if (textEl) { textEl.textContent = timerStr; textEl.style.color = timerColor; }
  if (barEl)  { barEl.style.width = pct + '%'; barEl.style.background = timerColor; }
}
