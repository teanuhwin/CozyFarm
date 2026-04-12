// ── BODIE GUIDE MODULE ────────────────────────────────────
// Bodie is a persistent farm guide whose tip always reflects
// the player's *current* most relevant milestone. The "read"
// state resets automatically whenever the active tip changes,
// so Bodie lights up again on new progress.

import {
  state, saveState,
  CROPS, BARN_BASE_CAP, WATER_UNLOCK_COINS, FERT_UNLOCK_COINS,
} from './state.js';
import { MERCHANT_UNLOCK_COINS } from './npcs.js';

// ── TIP DEFINITIONS ───────────────────────────────────────
// Each tip has:
//   id       – stable key stored in state; change = Bodie re-lights
//   check(s) – pure fn over state; first passing tip wins (ordered priority)
//   text     – what Bodie says

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
    text: 'Hi! Im Bodie. Beautiful day! ☀️ Crops are growing faster in the sun!',
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
    text: 'Hi! Im Bodie. Oh no. Are you... begging for seeds? Embarrassing~',
  },

  // ── Late-game milestones ──────────────────────────────────
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
    text: "Hi! Im Bodie. THE TOWN IS OPEN! Go meet your neighbors in the Town tab. They're a little strange.",
  },

  // ── Merchants ─────────────────────────────────────────────
  {
    id: 'merchants_unlocked',
    check: s => (s.lifetimeCoins || 0) >= MERCHANT_UNLOCK_COINS,
    text: 'Hi! Im Bodie. Whoa — roaming merchants Mochi and Moto will start visiting your farm! Keep an eye out for ☀️ and 🌙 on the farm.',
  },

  // ── Crop unlocks (ordered from latest → earliest so higher threshold wins) ──
  {
    id: 'truffle_unlocked',
    check: s => (s.lifetimeCoins || 0) >= CROPS.truffle.unlockCoins,
    text: "Hi! Im Bodie. TRUFFLES! 🍄 You've hit the big leagues. Check the Shop — they're slow but worth every coin.",
  },
  {
    id: 'pumpkin_unlocked',
    check: s => (s.lifetimeCoins || 0) >= CROPS.pumpkin.unlockCoins,
    text: 'Hi! Im Bodie. Pumpkins unlocked! 🎃 They take 15 minutes but sell for a lot more. Worth the wait.',
  },
  {
    id: 'corn_unlocked',
    check: s => (s.lifetimeCoins || 0) >= CROPS.corn.unlockCoins,
    text: 'Hi! Im Bodie. Corn is available! 🌽 Check the Shop — it grows slower than wheat but earns a lot more per harvest.',
  },

  // ── Supply unlocks ────────────────────────────────────────
  {
    id: 'fert_unlocked',
    check: s => (s.lifetimeCoins || 0) >= FERT_UNLOCK_COINS,
    text: 'Hi! Im Bodie. Fertilizer is now in the Shop! 🌿 Apply it to a growing crop for bonus yield on harvest.',
  },
  {
    id: 'water_unlocked',
    check: s => (s.lifetimeCoins || 0) >= WATER_UNLOCK_COINS,
    text: 'Hi! Im Bodie. Water is now in the Shop! 💧 Apply it to a growing crop to speed it up by 35%.',
  },

  // ── Gloves ────────────────────────────────────────────────
  {
    id: 'gloves_unlocked',
    check: s => (s.stats?.wheatHarvests || 0) >= 20,
    text: 'Hi! Im Bodie. Gloves are now in the Shop! 🧤 They give you a 60% chance to recover a seed on every harvest.',
  },

  // ── Barn & farm growth ────────────────────────────────────
  {
    id: 'barn_upgraded',
    check: s => (s.barnLevel || 0) >= 1,
    text: 'Hi! Im Bodie. Nice barn upgrade! More room means you can stockpile more crops before selling.',
  },
  {
    id: 'hint_expand',
    check: s => s.coins >= 50 && s.rows <= 2 && s.cols <= 2,
    text: "Hi! Im Bodie. Your farm is feeling a little cramped! You can add rows and columns in the Shop tab.",
  },
  {
    id: 'hint_barn',
    check: s => s.coins >= 30 && (s.barnLevel || 0) === 0,
    text: `Hi! Im Bodie. Psst~ Your barn only holds ${BARN_BASE_CAP} crops. Sell some and think about upgrading it!`,
  },

  // ── First sell ────────────────────────────────────────────
  {
    id: 'first_sell',
    check: s => (s.stats?.sellActions || 0) >= 1,
    text: "Hi! Im Bodie. Good selling! Keep farming and you'll unlock more crops and supplies as you earn more coins.",
  },

  // ── First harvest ─────────────────────────────────────────
  {
    id: 'first_harvest',
    check: s => (s.stats?.totalHarvests || 0) >= 1,
    text: 'Hi! Im Bodie. Great harvest! Head to the Shop tab to sell your crops for coins.',
  },

  // ── Absolute start (fallback) ─────────────────────────────
  {
    id: 'start',
    check: () => true,
    text: "Hi! Im Bodie. Welcome to Cozy Farm! You've got wheat seeds. Tap an empty plot to plant one.",
  },
];

// ── ACTIVE TIP RESOLVER ───────────────────────────────────

export function getActiveTip() {
  return BODIE_TIPS.find(tip => {
    try { return tip.check(state); } catch { return false; }
  }) || null;
}

export function isBodieUnread() {
  const tip = getActiveTip();
  if (!tip) return false;
  return state.bodieLastReadTip !== tip.id;
}

export function markBodieRead() {
  const tip = getActiveTip();
  if (!tip) return;
  state.bodieLastReadTip = tip.id;
  saveState();
}
