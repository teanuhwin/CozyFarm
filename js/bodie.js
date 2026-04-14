// ── BODIE GUIDE MODULE ────────────────────────────────────
// Tips fire exactly once and are permanently remembered.
// Any newly-satisfied tips get enqueued; Bodie lights up
// while the queue is non-empty. Clicking dequeues one tip,
// shows it, and logs it to the Book of Barns collection.
//
// Weather tips re-fire each new event (keyed by changedAt).
// Merchant tips re-fire each new purchase (keyed by arrivedAt).

import {
  state, saveState,
  CROPS, BARN_BASE_CAP, WATER_UNLOCK_COINS, FERT_UNLOCK_COINS,
} from './state.js';
import { MERCHANT_UNLOCK_COINS } from './npcs.js';

// ── TIP DEFINITIONS ───────────────────────────────────────
// id         – stable base key
// check(s)   – pure fn over state; returns true when tip is relevant
// text       – what Bodie says
// icon       – emoji shown in the Book of Barns entry
// weather    – re-queueable per weather event (keyed by changedAt)
// merchant   – re-queueable per merchant visit (keyed by arrivedAt)

export const BODIE_TIPS = [
  // ── Weather events ───────────────────────────────────────
  {
    id: 'weather_thunder',
    icon: '⛈️',
    weather: true,
    check: s => s.weather?.current === 'thunder',
    text: 'Hi! Im Bodie. Uh oh, thunder! Lightning can zap your crops. Harvest what you can fast!',
  },
  {
    id: 'weather_flood',
    icon: '🌊',
    weather: true,
    check: s => s.weather?.current === 'flood',
    text: 'Hi! Im Bodie. FLOOD! One row is underwater until the weather changes. Nothing you can do but wait it out.',
  },
  {
    id: 'weather_sunny',
    icon: '☀️',
    weather: true,
    check: s => s.weather?.current === 'sunny',
    text: 'Hi! Im Bodie. Beautiful day! ☀️ Crops are growing faster in the sun!',
  },
  {
    id: 'weather_overcast',
    icon: '☁️',
    weather: true,
    check: s => s.weather?.current === 'overcast',
    text: "Hi! Im Bodie. Uh oh. Crops seem to be slowing down. Don't worry, the clouds will pass soon. Probably…",
  },

  // ── Mochi purchases (re-fire each visit) ─────────────────
  {
    id: 'merchant_helios',
    icon: '🌟',
    merchant: true,
    check: s => s.merchant?.effect?.id === 'helios',
    text: "Hi! Im Bodie. Mochi sold you the Helios Serum! 🌟 All sell prices are up 20% for the next 2 hours. Sell big!",
  },
  {
    id: 'merchant_sundial',
    icon: '⏳',
    merchant: true,
    check: s => {
      const t = s.merchant?.lastSundialAt;
      return !!t && Date.now() - t < 10000;
    },
    text: "Hi! Im Bodie. Mochi's Sundial Dust! ⏳ All your crops just aged by 10 minutes. That's cheating. Nice.",
  },
  {
    id: 'merchant_lightleaf',
    icon: '🫙',
    merchant: true,
    check: s => s.merchant?.effect?.id === 'lightleaf',
    text: "Hi! Im Bodie. Light-Leaf Oil is active! 🫙 Your crops take up zero barn space for the next hour. Harvest away!",
  },
  {
    id: 'merchant_photosynth',
    icon: '🌿',
    merchant: true,
    check: s => s.merchant?.effect?.id === 'photosynth',
    text: "Hi! Im Bodie. Photosynthesis is active! 🌿 Flood and Overcast can't touch your farm for an hour. Weather? Pfft.",
  },

  // ── Moto outcomes (re-fire each visit) ───────────────────
  {
    id: 'merchant_instant_growth',
    icon: '⚡',
    merchant: true,
    check: s => s.merchant?.motoOutcome?.riddleId === 'flash_stone' && s.merchant?.motoOutcome?.isGood === true,
    text: "Hi! Im Bodie. Moto's dice landed good! ⚡ Instant Growth — all your planted crops are ready RIGHT NOW.",
  },
  {
    id: 'merchant_frozen',
    icon: '🧊',
    merchant: true,
    check: s => s.merchant?.effect?.id === 'frozen',
    text: "Hi! Im Bodie. Moto's dice landed bad. 🧊 Frozen Soil — all crop timers are paused for 30 minutes. Yikes.",
  },
  {
    id: 'merchant_triple_sell',
    icon: '💰',
    merchant: true,
    check: s => s.merchant?.effect?.id === 'triple_sell',
    text: "Hi! Im Bodie. TRIPLE SELL is active! 💰 Your next 10 crops sell for 3× value. Don't waste it on wheat.",
  },
  {
    id: 'merchant_tax',
    icon: '💸',
    merchant: true,
    check: s => s.merchant?.motoOutcome?.riddleId === 'wealth_bowl' && s.merchant?.motoOutcome?.isGood === false,
    text: "Hi! Im Bodie. Moto took your coins. 💸 The Tax Man cometh. He really did say \"accidentally.\" I don't believe him.",
  },
  {
    id: 'merchant_miracle_harvest',
    icon: '🌱',
    merchant: true,
    check: s => s.merchant?.effect?.id === 'miracle_harvest',
    text: "Hi! Im Bodie. Miracle Harvest is active! 🌱 Every crop you pick gives +5 extra yield for 2 hours. Incredible.",
  },
  {
    id: 'merchant_barren',
    icon: '🥶',
    merchant: true,
    check: s => s.merchant?.effect?.id === 'barren',
    text: "Hi! Im Bodie. Barren Earth is active. 🥶 Your gloves won't return any seeds for an hour. Moto is laughing somewhere.",
  },
  {
    id: 'merchant_void_barn',
    icon: '🏚️',
    merchant: true,
    check: s => s.merchant?.effect?.id === 'void_barn',
    text: "Hi! Im Bodie. Void Barn is active! 🏚️ Unlimited storage for 2 hours. Harvest literally everything.",
  },
  {
    id: 'merchant_sticky',
    icon: '🐌',
    merchant: true,
    check: s => s.merchant?.effect?.id === 'sticky',
    text: "Hi! Im Bodie. Sticky Fingers is active. 🐌 One harvest every 10 seconds. Moto apologizes. He does not apologize.",
  },

  // ── Beg zone ─────────────────────────────────────────────
  {
    id: 'beg_zone',
    icon: '🙏',
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
    icon: '✨',
    check: s => {
      if (!s.npcs) return false;
      return Object.values(s.npcs).some(n => (n.affinity || 0) >= 15);
    },
    text: "Hi! Im Bodie. MAX AFFINITY! You're basically a local legend now. I don't think you need me anymore…",
  },
  {
    id: 'town_unlocked',
    icon: '🏘️',
    check: s => s.rows >= 6 && s.cols >= 6 && s.barnLevel >= 3,
    text: "Hi! Im Bodie. THE TOWN IS OPEN! Go meet your neighbors in the Town tab. They're a little strange.",
  },

  // ── Merchants unlocked ────────────────────────────────────
  {
    id: 'merchants_unlocked',
    icon: '☀️',
    check: s => (s.lifetimeCoins || 0) >= MERCHANT_UNLOCK_COINS,
    text: 'Hi! Im Bodie. Whoa — roaming merchants Mochi and Moto will start visiting your farm! Keep an eye out for ☀️ and 🌙 on the farm.',
  },

  // ── Crop unlocks ─────────────────────────────────────────
  {
    id: 'truffle_unlocked',
    icon: '🍄',
    check: s => (s.lifetimeCoins || 0) >= CROPS.truffle.unlockCoins,
    text: "Hi! Im Bodie. TRUFFLES! 🍄 You've hit the big leagues. Check the Shop — they're slow but worth every coin.",
  },
  {
    id: 'pumpkin_unlocked',
    icon: '🎃',
    check: s => (s.lifetimeCoins || 0) >= CROPS.pumpkin.unlockCoins,
    text: 'Hi! Im Bodie. Pumpkins unlocked! 🎃 They take 15 minutes but sell for a lot more. Worth the wait.',
  },
  {
    id: 'corn_unlocked',
    icon: '🌽',
    check: s => (s.lifetimeCoins || 0) >= CROPS.corn.unlockCoins,
    text: 'Hi! Im Bodie. Corn is available! 🌽 Check the Shop — it grows slower than wheat but earns a lot more per harvest.',
  },

  // ── Supply unlocks ────────────────────────────────────────
  {
    id: 'fert_unlocked',
    icon: '🌿',
    check: s => (s.lifetimeCoins || 0) >= FERT_UNLOCK_COINS,
    text: 'Hi! Im Bodie. Fertilizer is now in the Shop! 🌿 Apply it to a growing crop for bonus yield on harvest.',
  },
  {
    id: 'water_unlocked',
    icon: '💧',
    check: s => (s.lifetimeCoins || 0) >= WATER_UNLOCK_COINS,
    text: 'Hi! Im Bodie. Water is now in the Shop! 💧 Apply it to a growing crop to speed it up by 35%.',
  },

  // ── Gloves ────────────────────────────────────────────────
  {
    id: 'gloves_unlocked',
    icon: '🧤',
    check: s => (s.stats?.wheatHarvests || 0) >= 20,
    text: 'Hi! Im Bodie. Gloves are now in the Shop! 🧤 They give you a 60% chance to recover a seed on every harvest.',
  },

  // ── Barn & farm ───────────────────────────────────────────
  {
    id: 'barn_upgraded',
    icon: '🏚️',
    check: s => (s.barnLevel || 0) >= 1,
    text: 'Hi! Im Bodie. Nice barn upgrade! More room means you can stockpile more crops before selling.',
  },
  {
    id: 'hint_expand',
    icon: '🏡',
    check: s => s.coins >= 50 && s.rows <= 2 && s.cols <= 2,
    text: "Hi! Im Bodie. Your farm is feeling a little cramped! You can add rows and columns in the Shop tab.",
  },
  {
    id: 'hint_barn',
    icon: '🏚️',
    check: s => s.coins >= 30 && (s.barnLevel || 0) === 0,
    text: `Hi! Im Bodie. Psst~ Your barn only holds ${BARN_BASE_CAP} crops. Sell some and think about upgrading it!`,
  },

  // ── Early progression ─────────────────────────────────────
  {
    id: 'first_sell',
    icon: '🪙',
    check: s => (s.stats?.sellActions || 0) >= 1,
    text: "Hi! Im Bodie. Good selling! Keep farming and you'll unlock more crops and supplies as you earn more coins.",
  },
  {
    id: 'first_harvest',
    icon: '🌾',
    check: s => (s.stats?.totalHarvests || 0) >= 1,
    text: 'Hi! Im Bodie. Great harvest! Head to the Shop tab to sell your crops for coins.',
  },

  // ── Fallback ─────────────────────────────────────────────
  {
    id: 'start',
    icon: '🐾',
    check: () => true,
    text: "Hi! Im Bodie. Welcome to Cozy Farm! You've got wheat seeds. Tap an empty plot to plant one.",
  },
];

// ── SEEN KEY HELPERS ──────────────────────────────────────

function weatherSeenKey(tipId) {
  const w = state.weather;
  if (!w) return tipId;
  return `${tipId}__${w.current}__${w.changedAt || 0}`;
}

function merchantSeenKey(tipId) {
  const arrivedAt = state.merchant?.arrivedAt || 0;
  return `${tipId}__merchant__${arrivedAt}`;
}

function tipSeenKey(tip) {
  if (tip.weather)  return weatherSeenKey(tip.id);
  if (tip.merchant) return merchantSeenKey(tip.id);
  return tip.id;
}

// ── SEEN SET ──────────────────────────────────────────────
function seenSet() {
  if (!Array.isArray(state.bodieSeenTips)) state.bodieSeenTips = [];
  return new Set(state.bodieSeenTips);
}

function markSeen(key) {
  if (!Array.isArray(state.bodieSeenTips)) state.bodieSeenTips = [];
  if (!state.bodieSeenTips.includes(key)) {
    state.bodieSeenTips.push(key);
  }
}

// ── COLLECTION LOG ────────────────────────────────────────
function addToCollection(key, tip) {
  if (!Array.isArray(state.bodieCollectedTips)) state.bodieCollectedTips = [];
  state.bodieCollectedTips.push({
    key,
    id:        tip.id,
    icon:      tip.icon || '🐾',
    text:      tip.text,
    timestamp: Date.now(),
  });
}

// ── QUEUE ─────────────────────────────────────────────────
function getQueue() {
  if (!Array.isArray(state.bodieQueue)) state.bodieQueue = [];
  return state.bodieQueue;
}

export function refreshBodieQueue() {
  const seen    = seenSet();
  const queue   = getQueue();
  const inQueue = new Set(queue);

  for (const tip of BODIE_TIPS) {
    const key = tipSeenKey(tip);
    if (seen.has(key) || inQueue.has(key)) continue;
    try {
      if (tip.check(state)) {
        queue.push(key);
        inQueue.add(key);
      }
    } catch { /* guard against bad state */ }
  }
}

// ── PUBLIC API ────────────────────────────────────────────

export function getActiveTip() {
  const queue = getQueue();
  if (queue.length === 0) return null;
  const key       = queue[0];
  const baseTipId = key.split('__')[0];
  return BODIE_TIPS.find(t => t.id === baseTipId) || null;
}

export function isBodieUnread() {
  refreshBodieQueue();
  return getQueue().length > 0;
}

export function markBodieRead() {
  const queue = getQueue();
  if (queue.length === 0) return;
  const key       = queue.shift();
  const baseTipId = key.split('__')[0];
  const tip       = BODIE_TIPS.find(t => t.id === baseTipId);
  markSeen(key);
  if (tip) addToCollection(key, tip);
  saveState();
}

/** Returns all collected tips, newest first, for the Book of Barns. */
export function getCollectedTips() {
  if (!Array.isArray(state.bodieCollectedTips)) return [];
  return [...state.bodieCollectedTips].reverse();
}

/** Returns the number of tips currently pending in the queue. */
export function getBodieQueueLength() {
  refreshBodieQueue();
  return getQueue().length;
}
