// ── BODIE GUIDE MODULE ────────────────────────────────────
import {
  state, saveState,
  CROPS, BARN_BASE_CAP, WATER_UNLOCK_COINS, FERT_UNLOCK_COINS,
} from './state.js';
import { MERCHANT_UNLOCK_COINS, NPC_DATA } from './npcs.js';
import {
  BANQUET_SCHEDULE, POT_BASE, PERMIT_BASE_COST, PERMIT_SCALE,
} from './banquet.js';

// ── BANQUET TIP HELPERS ───────────────────────────────────

// Pre-built lookup so host names resolve correctly in tip text.
const NPC_DISPLAY_NAMES = Object.fromEntries(
  Object.entries(NPC_DATA).map(([id, data]) => [id, data.name])
);

/** Returns the per-run pot requirements as a human-readable string. */
function potReqStr(runs) {
  const EMOJI = { wheat: '🌾', corn: '🌽', pumpkin: '🎃', truffle: '🍄' };
  return POT_BASE.map(r => `${r.qty + runs * r.scale} ${EMOJI[r.cropKey]}`).join(', ');
}

/** Returns the permit cost for a given run. */
function permitCostFor(runs) {
  return PERMIT_BASE_COST + runs * PERMIT_SCALE;
}

/**
 * Generates one Bodie tip per party in BANQUET_SCHEDULE.
 * Each is "banquet"-keyed so it fires the first time that run becomes available.
 */
function buildBanquetTips() {
  return BANQUET_SCHEDULE.map((party, idx) => {
    const MERCHANT_HOST_NAMES = { mochi: 'Mochi ☀️', moto: 'Moto 🌙' };
    return {
      id:      `banquet_party_${idx}`,
      icon:    party.emoji,
      banquet: true,
      check: s => {
        if (!s.banquet) return false;
        const runs = s.banquet.completedRuns || 0;
        if (runs !== idx) return false;
        const NPC_IDS = ['kimchi','kalbi','ellie','twins','maru','cinna','kola'];
        return NPC_IDS.every(id => (s.npcs?.[id]?.affinity || 0) >= 15);
      },
      get text() {
        const runs     = idx;
        const cost     = permitCostFor(runs).toLocaleString();
        const crops    = potReqStr(runs);
        const hostName = MERCHANT_HOST_NAMES[party.hostId]
          ?? NPC_DISPLAY_NAMES[party.hostId]
          ?? party.hostId;
        return `Hi! Im Bodie. ${party.desc} Looks like you'll need ${crops} and 🪙${cost} for the ${party.name}. ${hostName} is hosting — don't be late!`;
      },
    };
  });
}

const BANQUET_TIPS = buildBanquetTips();

export const BODIE_TIPS = [
  { id:'weather_thunder',  icon:'⛈️', weather:true,  check: s => s.weather?.current === 'thunder',  text:'Hi! Im Bodie. Uh oh, thunder! Lightning can zap your crops. Harvest what you can fast!' },
  { id:'weather_flood',    icon:'🌊', weather:true,  check: s => s.weather?.current === 'flood',    text:'Hi! Im Bodie. FLOOD! One row is underwater until the weather changes. Nothing you can do but wait it out.' },
  { id:'weather_sunny',    icon:'☀️', weather:true,  check: s => s.weather?.current === 'sunny',    text:'Hi! Im Bodie. Beautiful day! ☀️ Crops are growing faster in the sun!' },
  { id:'weather_overcast', icon:'☁️', weather:true,  check: s => s.weather?.current === 'overcast', text:"Hi! Im Bodie. Uh oh. Crops seem to be slowing down. Don't worry, the clouds will pass soon. Probably…" },
  { id:'merchant_helios',      icon:'🌟', merchant:true, check: s => s.merchant?.effect?.id === 'helios',          text:"Hi! Im Bodie. Mochi sold you the Helios Serum! 🌟 All sell prices are up 50% for the next 2 hours. Sell big!" },
  { id:'merchant_sundial',     icon:'⏳', merchant:true, check: s => { const t = s.merchant?.lastSundialAt; return !!t && Date.now() - t < 10000; }, text:"Hi! Im Bodie. Mochi's Sundial Dust! ⏳ All your crops just aged by 15 minutes. That's cheating. Nice." },
  { id:'merchant_photosynth',  icon:'🌿', merchant:true, check: s => s.merchant?.effect?.id === 'photosynth',       text:"Hi! Im Bodie. Photosynthesis is active! 🌿 That's 3 more crops per harvest for 30 minutes!" },
  { id:'merchant_instant_growth', icon:'⚡', merchant:true, check: s => s.merchant?.motoOutcome?.riddleId === 'flash_stone' && s.merchant?.motoOutcome?.isGood === true, text:"Hi! Im Bodie. Moto's dice landed good! ⚡ Instant Growth — all your planted crops are ready RIGHT NOW." },
  { id:'merchant_frozen',      icon:'🧊', merchant:true, check: s => s.merchant?.effect?.id === 'frozen',           text:"Hi! Im Bodie. Moto's dice landed bad. 🧊 Frozen Soil — all crop timers are paused for 30 minutes. Yikes." },
  { id:'merchant_triple_sell', icon:'💰', merchant:true, check: s => s.merchant?.effect?.id === 'triple_sell',      text:"Hi! Im Bodie. TRIPLE SELL is active! 💰 Your next 30 crops sell for 3× value. Don't waste it on wheat." },
  { id:'merchant_tax',         icon:'💸', merchant:true, check: s => s.merchant?.motoOutcome?.riddleId === 'wealth_bowl' && s.merchant?.motoOutcome?.isGood === false, text:"Hi! Im Bodie. Moto took your coins. 💸 The Tax Man cometh. Did he say \"accidentally?\" I don't believe him." },
  { id:'merchant_miracle_harvest', icon:'🌱', merchant:true, check: s => s.merchant?.effect?.id === 'miracle_harvest', text:"Hi! Im Bodie. Miracle Harvest is active! 🌱 Every crop you pick gives +5 extra yield for 2 hours. Incredible." },
  { id:'merchant_barren',      icon:'🥶', merchant:true, check: s => s.merchant?.effect?.id === 'barren',           text:"Hi! Im Bodie. Barren Earth is active. 🥶 All those rows are gone... Moto is laughing somewhere." },
  { id:'merchant_void_barn',   icon:'🏚️', merchant:true, check: s => s.merchant?.effect?.id === 'void_barn',        text:"Hi! Im Bodie. Void Barn is active! 🏚️ Unlimited storage for 1 hour. Harvest literally everything." },
  { id:'merchant_sticky',      icon:'🐌', merchant:true, check: s => s.merchant?.effect?.id === 'sticky',           text:"Hi! Im Bodie. Sticky Fingers is active. 🐌 One harvest every 5 seconds. I apologize. Moto does not apologize." },
  // ── Banquet party tips (15 total, one per party) ──────
  ...BANQUET_TIPS,
  // ── Milestone tips ────────────────────────────────────
  { id:'beg_zone', icon:'🙏', check: s => { const total = (s.wheatSeeds||0)+(s.cornSeeds||0)+(s.pumpkinSeeds||0)+(s.truffleSeeds||0); const barn = (s.wheat||0)+(s.corn||0)+(s.pumpkin||0)+(s.truffle||0); return total === 0 && barn === 0 && s.coins < CROPS.wheat.seedCost; }, text:'Hi! Im Bodie. Oh no. Are you... begging for seeds? Embarrassing~' },
  { id:'npc_max_affinity', icon:'✨', check: s => { if (!s.npcs) return false; return Object.values(s.npcs).some(n => (n.affinity || 0) >= 15); }, text:"Hi! Im Bodie. MAX AFFINITY! You're basically a local legend now. I don't think you need me anymore…" },
  { id:'town_unlocked',    icon:'🏘️', check: s => s.rows >= 6 && s.cols >= 6 && s.barnLevel >= 3, text:"Hi! Im Bodie. THE TOWN IS OPEN! Go meet your neighbors in the Town tab. They're a little strange." },
  { id:'merchants_unlocked', icon:'☀️', check: s => (s.lifetimeCoins || 0) >= MERCHANT_UNLOCK_COINS, text:'Hi! Im Bodie. Whoa — roaming merchants Mochi and Moto will start visiting! Keep an eye out for ☀️ and 🌙 on the farm.' },
  { id:'grand_banquet_unlocked', icon:'🎊', check: s => { if (!s.npcs) return false; const NPC_ORDER = ['kimchi','kalbi','ellie','twins','maru','cinna','kola']; return NPC_ORDER.every(id => (s.npcs[id]?.affinity || 0) >= 15); }, text:"Hi! Im Bodie. ALL neighbors maxed out! 🎊 The Grand Banquet is available! Check the Town tab — it's time for a party!" },
  { id:'pride_level1', icon:'🌟', check: s => (s.pridePoints || 0) >= 3, text:"Hi! Im Bodie. Town Pride Level 1! 🌟 You now have a 5% chance for +5 bonus crops on every harvest. Nice!" },
  { id:'truffle_unlocked', icon:'🍄', check: s => (s.lifetimeCoins || 0) >= CROPS.truffle.unlockCoins, text:"Hi! Im Bodie. TRUFFLES! 🍄 You've hit the big leagues. Check the Shop — they're the slowest but sell for lots of coins." },
  { id:'pumpkin_unlocked', icon:'🎃', check: s => (s.lifetimeCoins || 0) >= CROPS.pumpkin.unlockCoins, text:'Hi! Im Bodie. Pumpkins unlocked! 🎃 They take 15 minutes but sell for even more. Worth the wait.' },
  { id:'corn_unlocked',    icon:'🌽', check: s => (s.lifetimeCoins || 0) >= CROPS.corn.unlockCoins,    text:'Hi! Im Bodie. Corn is available! 🌽 Check the Shop — it grows slower than wheat but earns more per harvest.' },
  { id:'fert_unlocked',    icon:'🌿', check: s => (s.lifetimeCoins || 0) >= FERT_UNLOCK_COINS,         text:'Hi! Im Bodie. Fertilizer is now in the Shop! 🌿 Apply it to a growing crop for bonus yield on harvest.' },
  { id:'water_unlocked',   icon:'💧', check: s => (s.lifetimeCoins || 0) >= WATER_UNLOCK_COINS,        text:'Hi! Im Bodie. Water is now in the Shop! 💧 Apply it to a growing crop to speed it up by 35%.' },
  { id:'gloves_unlocked',  icon:'🧤', check: s => (s.stats?.wheatHarvests || 0) >= 20,                 text:'Hi! Im Bodie. Gloves are now in the Shop! 🧤 They give you a 60% chance to recover a seed on every harvest.' },
  { id:'barn_upgraded',    icon:'🏚️', check: s => (s.barnLevel || 0) >= 1,                             text:'Hi! Im Bodie. Nice barn upgrade! More room means you can stockpile more crops before selling.' },
  { id:'hint_expand',      icon:'🏡', check: s => s.coins >= 50 && s.rows <= 2 && s.cols <= 2,          text:"Hi! Im Bodie. Your farm is feeling a little cramped! You can add rows and columns in the Shop tab." },
  { id:'hint_barn',        icon:'🏚️', check: s => s.coins >= 30 && (s.barnLevel || 0) === 0,            text:`Hi! Im Bodie. Psst~ Your barn only holds ${BARN_BASE_CAP} crops. Sell some and think about upgrading it!` },
  { id:'first_sell',       icon:'🪙', check: s => (s.stats?.sellActions || 0) >= 1,                     text:"Hi! Im Bodie. Nice sale! Keep farming and you'll unlock more crops and supplies as you earn more coins." },
  { id:'first_harvest',    icon:'🌾', check: s => (s.stats?.totalHarvests || 0) >= 1,                   text:'Hi! Im Bodie. Great harvest! Head to the Shop tab to sell your crops for coins.' },
  { id:'start',            icon:'🐾', check: () => true,                                                 text:"Hi! Im Bodie. Welcome to Cozy Farm! You've got wheat seeds. Tap an empty plot to plant one." },
];

function weatherSeenKey(tipId)  { const w = state.weather; if (!w) return tipId; return `${tipId}__${w.current}__${w.changedAt || 0}`; }
function merchantSeenKey(tipId) { const arrivedAt = state.merchant?.arrivedAt || 0; return `${tipId}__merchant__${arrivedAt}`; }
// Banquet tips key off the full cycle count so the same party tip re-fires each time the
// 15-party schedule loops around. cycle = Math.floor(completedRuns / 15).
function banquetSeenKey(tipId)  { const runs = state.banquet?.completedRuns || 0; const cycle = Math.floor(runs / BANQUET_SCHEDULE.length); return `${tipId}__banquet__cycle${cycle}`; }
function tipSeenKey(tip)        { if (tip.weather) return weatherSeenKey(tip.id); if (tip.merchant) return merchantSeenKey(tip.id); if (tip.banquet) return banquetSeenKey(tip.id); return tip.id; }

function seenSet()      { if (!Array.isArray(state.bodieSeenTips)) state.bodieSeenTips = []; return new Set(state.bodieSeenTips); }
function markSeen(key)  { if (!Array.isArray(state.bodieSeenTips)) state.bodieSeenTips = []; if (!state.bodieSeenTips.includes(key)) state.bodieSeenTips.push(key); }

function addToCollection(key, tip) {
  if (!Array.isArray(state.bodieCollectedTips)) state.bodieCollectedTips = [];
  state.bodieCollectedTips.push({ key, id:tip.id, icon:tip.icon || '🐾', text:tip.text, timestamp:Date.now() });
}

function getQueue() { if (!Array.isArray(state.bodieQueue)) state.bodieQueue = []; return state.bodieQueue; }

export function refreshBodieQueue() {
  const seen    = seenSet();
  const queue   = getQueue();
  const inQueue = new Set(queue);
  for (const tip of BODIE_TIPS) {
    const key = tipSeenKey(tip);
    if (seen.has(key) || inQueue.has(key)) continue;
    try { if (tip.check(state)) { queue.push(key); inQueue.add(key); } } catch { /* guard */ }
  }
}

export function getActiveTip() {
  const queue = getQueue();
  if (queue.length === 0) return null;
  const key = queue[0];
  const baseTipId = key.split('__')[0];
  return BODIE_TIPS.find(t => t.id === baseTipId) || null;
}

export function isBodieUnread() { refreshBodieQueue(); return getQueue().length > 0; }

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

export function getCollectedTips() {
  if (!Array.isArray(state.bodieCollectedTips)) return [];
  return [...state.bodieCollectedTips].reverse();
}

export function getBodieQueueLength() { refreshBodieQueue(); return getQueue().length; }
