// ── BODIE GUIDE MODULE ────────────────────────────────────
// Bodie is a persistent farm guide whose tip always reflects
// the player's *current* most relevant milestone. The "read"
// state resets automatically whenever the active tip changes
// (Option A), so Bodie lights up again on new progress.

import {
  state, saveState,
  CROPS, BARN_BASE_CAP,
} from './state.js';

// ── TIP DEFINITIONS ───────────────────────────────────────
// Each tip has:
//   id       – stable key stored in state; change = Bodie re-lights
//   check(s) – pure fn over state; first passing tip wins (ordered priority)
//   text     – what Bodie says
//
// Economy-sensitive values are pulled from imported constants so they
// stay in sync if numbers change in state.js.

export const BODIE_TIPS = [
  // ── Weather events (checked first — time-sensitive) ──────
  {
    id: 'weather_thunder',
    check: s => s.weather?.current === 'thunder',
    text: 'Hi! Im Bodie. Uh oh, thunder! Lightning can zap your crops. Harvest what you can fast!',
  },
  {
    id: 'weather_flood',
    check: s => s.weather?.current === 'flood',
    text: 'Hi! Im Bodie. FLOOD! One row is underwater until the weather changes. Nothing you can do but wait it out.',
  },
  {
    id: 'weather_sunny',
    check: s => s.weather?.current === 'sunny',
    text: 'Hi! Im Bodie. Beautiful day! ☀️ Crops growing faster in sun!',
  },
  {
    id: 'weather_overcast',
    check: s => s.weather?.current === 'overcast',
    text: "Hi! Im Bodie. Uh oh. Crops seem to be slowing down. Don't worry, the clouds will pass soon. Probably…",
  },

  // ── Beg zone visible ─────────────────────────────────────
  {
    id: 'beg_zone',
    check: s => {
      const totalSeeds = (s.wheatSeeds||0)+(s.cornSeeds||0)+(s.pumpkinSeeds||0)+(s.truffleSeeds||0);
      const barnTotal  = (s.wheat||0)+(s.corn||0)+(s.pumpkin||0)+(s.truffle||0);
      return totalSeeds === 0 && barnTotal === 0 && s.coins < CROPS.wheat.seedCost;
    },
    text: 'Hi! Im Bodie. Oh no. Are you... begging for seeds? Embarassing~',
  },

  // ── Late game milestones ──────────────────────────────────
  {
    id: 'npc_max_affinity',
    check: s => {
      if (!s.npcs) return false;
      return Object.values(s.npcs).some(n => (n.affinity || 0) >= 15);
    },
    text: "Hi! Im Bodie. MAX AFFINITY! You're basically a local legend now. I don't think you need me anymore…",
  },
  {
    id: 'town_unlocked',
    check: s => s.rows >= 6 && s.cols >= 6 && s.barnLevel >= 3,
    text: "Hi! Im Bodie. THE TOWN IS OPEN! Go meet your neighbors. They're a little strange.",
  },

  // ── Crop unlocks (use unlockCoins from CROPS constant) ───
  {
    id: 'truffle_unlocked',
    check: s => (s.lifetimeCoins || 0) >= CROPS.truffle.unlockCoins,
    text: "Hi! Im Bodie. Truffles?! You're basically a professional now. I'm so proud.",
  },
  {
    id: 'gloves_unlocked',
    check: s => (s.stats?.wheatHarvests || 0) >= 20,
    text: 'Hi! Im Bodie. Cool Gloves! They give you a chance to recover seeds on harvest. Find them in the Shop.',
  },
  {
    id: 'pumpkin_unlocked',
    check: s => (s.lifetimeCoins || 0) >= CROPS.pumpkin.unlockCoins,
    text: 'Hi! Im Bodie. Pumpkins! These take a while but they\'re worth it. Patience is a virtue.',
  },
  {
    id: 'corn_unlocked',
    check: s => (s.lifetimeCoins || 0) >= CROPS.corn.unlockCoins,
    text: 'Hi! Im Bodie. Ooh, Corn! Longer grow time, but way more coin per harvest. Check the Shop.',
  },

  // ── Barn & farm growth ────────────────────────────────────
  {
    id: 'barn_upgraded',
    check: s => (s.barnLevel || 0) >= 1,
    text: 'Hi! Im Bodie. Much better! More room means more crops means more coins. The math checks out.',
  },
  {
    id: 'hint_expand',
    check: s => s.coins >= 50 && s.rows <= 2 && s.cols <= 2,
    text: "Hi! Im Bodie. Your farm feels a little small, don't you think? You can add rows and columns in the Shop.",
  },
  {
    id: 'hint_barn',
    check: s => s.coins >= 30 && (s.barnLevel || 0) === 0,
    text: `Hi! Im Bodie. Psst~ Your barn only holds ${BARN_BASE_CAP} crops. Sell some and think about upgrading it soon.`,
  },

  // ── First harvest ─────────────────────────────────────────
  {
    id: 'first_harvest',
    check: s => (s.stats?.totalHarvests || 0) >= 1,
    text: 'Hi! Im Bodie. Nice work! Head to the Shop tab to sell your crops for coins.',
  },

  // ── Absolute start (fallback) ─────────────────────────────
  {
    id: 'start',
    check: () => true,
    text: "Hi! Im Bodie. Welcome to Cozy Farm! You've got wheat seeds. Tap an empty plot to plant one.",
  },
];

// ── ACTIVE TIP RESOLVER ───────────────────────────────────

/** Returns the highest-priority matching tip object, or null. */
export function getActiveTip() {
  return BODIE_TIPS.find(tip => {
    try { return tip.check(state); } catch { return false; }
  }) || null;
}

/** Returns true if the current tip is unread (Bodie should glow). */
export function isBodieUnread() {
  const tip = getActiveTip();
  if (!tip) return false;
  return state.bodieLastReadTip !== tip.id;
}

/** Mark the current tip as read and persist. */
export function markBodieRead() {
  const tip = getActiveTip();
  if (!tip) return;
  state.bodieLastReadTip = tip.id;
  saveState();
}
