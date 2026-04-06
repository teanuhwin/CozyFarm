// ── MERCHANT MODULE ───────────────────────────────────────
// Mochi (☀️) and Moto (🌙) — roaming merchant siblings
import { state, saveState, randInt } from './state.js';
import { CAPSTONE_COIN_COSTS } from './npcs.js';
import { toast } from './ui.js';

// ── CONSTANTS ─────────────────────────────────────────────

// Grid-size-based cost for Mochi (Moto = half)
function mochiCost() {
  const plots = state.rows * state.cols;
  const gridBase = plots <= 4 ? 500 : plots <= 9 ? 1000 : plots <= 16 ? 2000 : plots <= 25 ? 3500 : 5000;
  // Scale with lifetime coins above 500K so merchants feel costly in late game
  const lifetimeBased = Math.floor((state.lifetimeCoins || 0) * 0.005);
  return Math.max(gridBase, Math.min(lifetimeBased, 50000));
}

const MERCHANT_STAY_MS   = 10 * 60 * 1000;  // 10 min to act before auto-dismiss
const VISIT_WINDOW_MIN   = 30 * 60 * 1000;  // min 30 min between visits
const VISIT_WINDOW_MAX   = 60 * 60 * 1000;  // max 60 min between visits
const SIBLING_DELAY_MIN  = 20 * 60 * 1000;  // sibling arrives 20–30 min after decline
const SIBLING_DELAY_MAX  = 30 * 60 * 1000;

// Effect durations
const HELIOS_DURATION    = 2 * 60 * 60 * 1000;  // 2 hours
const LIGHTLEAF_DURATION = 1 * 60 * 60 * 1000;  // 1 hour
const PHOTOSYNTH_DURATION= 1 * 60 * 60 * 1000;  // 1 hour (same as weather cycle)
const VOID_BARN_DURATION = 2 * 60 * 60 * 1000;  // 2 hours
const FROZEN_DURATION    = 30 * 60 * 1000;       // 30 minutes
const TRIPLE_SELL_DURATION = null;               // item-count based (10 items)
const MIRACLE_DURATION   = null;                 // item-count based (per harvest)
const STICKY_DURATION    = 30 * 60 * 1000;       // 30 minutes

// ── MOCHI'S ITEMS ─────────────────────────────────────────
export const MOCHI_ITEMS = [
  {
    id: 'helios',
    name: 'Helios Serum',
    icon: '🌟',
    desc: 'Market Boom: All sell prices +20% for 2 hours.',
    effect: 'helios',
    duration: HELIOS_DURATION,
  },
  {
    id: 'sundial',
    name: 'Sundial Dust',
    icon: '⏳',
    desc: 'Time Warp: All current crop timers reduced by 10 minutes instantly.',
    effect: 'sundial',
    duration: null, // instant
  },
  {
    id: 'lightleaf',
    name: 'Light-Leaf Oil',
    icon: '🫙',
    desc: 'Weightless Harvest: Crops take 0 barn space for 1 hour.',
    effect: 'lightleaf',
    duration: LIGHTLEAF_DURATION,
  },
  {
    id: 'photosynth',
    name: 'Photosynthesis',
    icon: '🌿',
    desc: 'Perfect Growth: Crops immune to Flood and Overcast for 1 hour.',
    effect: 'photosynth',
    duration: PHOTOSYNTH_DURATION,
  },
];

// ── MOTO'S RIDDLES ────────────────────────────────────────
export const MOTO_RIDDLES = [
  {
    id: 'flash_stone',
    riddle: '"Fast as a flash, or slow as a stone?"',
    good: { label: '⚡ Instant Growth', desc: 'All planted crops finish growing immediately.' },
    bad:  { label: '🧊 Frozen Soil', desc: 'All crop timers pause for 30 minutes.' },
    effect_good: 'instant_growth',
    effect_bad:  'frozen',
    duration_bad: FROZEN_DURATION,
  },
  {
    id: 'wealth_bowl',
    riddle: '"Wealth for the soul, or a hole in the bowl?"',
    good: { label: '💰 Triple Sell', desc: 'Next 10 items sold go for 3× value.' },
    bad:  { label: '💸 Tax Man', desc: 'Moto "accidentally" takes 15% of your current coins.' },
    effect_good: 'triple_sell',
    effect_bad:  'tax',
    duration_bad: null, // instant
  },
  {
    id: 'seeds_twice',
    riddle: '"Seeds that bloom twice, or seeds that turn to ice?"',
    good: { label: '🌱 Miracle Harvest', desc: 'Every harvest gives +5 yield for 1 hour.' },
    bad:  { label: '🥶 Barren Earth', desc: 'Glove seed recovery drops to 0% for 1 hour.' },
    effect_good: 'miracle_harvest',
    effect_bad:  'barren',
    duration_bad: HELIOS_DURATION, // reusing 2h constant
  },
  {
    id: 'fits_sits',
    riddle: '"Everything fits, or everything sits?"',
    good: { label: '🏚️ Void Barn', desc: 'Unlimited barn capacity for 2 hours.' },
    bad:  { label: '🐌 Sticky Fingers', desc: 'You can only harvest one plot every 10 seconds for 30 minutes.' },
    effect_good: 'void_barn',
    effect_bad:  'sticky',
    duration_bad: STICKY_DURATION,
  },
];

// ── UNLOCK CHECK ──────────────────────────────────────────

export function isMerchantUnlocked() {
  if (!state.npcs) return false;
  return Object.values(state.npcs).some(npc =>
    Math.min(5, Math.floor((npc.affinity || 0) / 3)) >= 3
  );
}

// ── EFFECT HELPERS (read-only getters for main.js / ui.js) ─

export function getMerchantEffect() {
  return state.merchant?.effect || null;
}

export function effectActive(id) {
  const eff = getMerchantEffect();
  if (!eff) return false;
  if (eff.id !== id) return false;
  if (eff.expiresAt && Date.now() >= eff.expiresAt) return false;
  if (eff.usesLeft !== undefined && eff.usesLeft <= 0) return false;
  return true;
}

/** Flat sell price multiplier from active Mochi/Moto effects. */
export function getMerchantSellMult() {
  if (effectActive('helios'))      return 1.20;
  if (effectActive('triple_sell')) return 3.0;
  return 1.0;
}

/** Returns true if barn space should be ignored for this harvest. */
export function isBarnWeightless() {
  return effectActive('lightleaf') || effectActive('void_barn');
}

/** Extra yield per harvest from Moto miracle. */
export function getMiracleYield() {
  return effectActive('miracle_harvest') ? 5 : 0;
}

/** Returns true if crop timers are frozen. */
export function isTimerFrozen() {
  return effectActive('frozen');
}

/** Returns true if glove seed recovery is suppressed. */
export function isBarrenEarth() {
  return effectActive('barren');
}

/** Returns true if negative weather (flood, overcast) is blocked. */
export function isPhotosynthActive() {
  return effectActive('photosynth');
}

/** Returns minimum seconds between harvests (sticky fingers). */
export function getStickyDelay() {
  return effectActive('sticky') ? 10000 : 0; // ms
}

/** Consume one triple-sell use. Returns current mult (3 or 1). */
export function consumeTripleSellUse() {
  const eff = getMerchantEffect();
  if (!eff || eff.id !== 'triple_sell' || eff.usesLeft <= 0) return 1.0;
  eff.usesLeft--;
  if (eff.usesLeft <= 0) {
    state.merchant.effect = null;
    toast('💸 Triple Sell expired — all 10 items sold!');
  }
  saveState();
  return 3.0;
}

// ── TICK ──────────────────────────────────────────────────

export function tickMerchants() {
  if (!isMerchantUnlocked()) return;

  const m   = state.merchant;
  const now = Date.now();

  // 1. Expire active effect
  if (m.effect && m.effect.expiresAt && now >= m.effect.expiresAt) {
    const label    = m.effect.label || 'Effect';
    const wasFrozen = m.effect.id === 'frozen' && m.effect.frozenAt;
    const frozenDuration = wasFrozen ? (m.effect.expiresAt - m.effect.frozenAt) : 0;
    m.effect = null;
    // Shift all planted crop timers forward by the frozen duration so they
    // don't gain "free" growth time while soil was frozen
    if (frozenDuration > 0) {
      state.plots.forEach(p => {
        if (p.state === 'planted' && p.plantedAt) {
          p.plantedAt += frozenDuration;
        }
      });
    }
    if (!m.nextVisitAt || m.nextVisitAt <= now) {
      m.nextVisitAt = now + randInt(VISIT_WINDOW_MIN, VISIT_WINDOW_MAX);
    }
    saveState();
    toast(`⏰ ${label} has worn off.`);
    import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
    return;
  }

  // 2. Don't spawn a new merchant while an effect is active
  if (m.effect) return;

  // 3. Auto-dismiss if merchant has been waiting too long without action
  if (m.active && m.arrivedAt > 0 && now - m.arrivedAt >= MERCHANT_STAY_MS) {
    const who    = m.active;
    const icon   = who === 'mochi' ? '☀️' : '🌙';
    const name   = who === 'mochi' ? 'Mochi' : 'Moto';
    const sibling = who === 'mochi' ? 'moto' : 'mochi';
    m.active       = null;
    m.arrivedAt    = 0;
    m.activeItemId = null;
    m.activeRiddleId = null;
    m.nextMerchant = sibling;
    m.nextVisitAt  = now + randInt(SIBLING_DELAY_MIN, SIBLING_DELAY_MAX);
    saveState();
    toast(`${icon} ${name} left — no time to wait! ${sibling === 'mochi' ? '☀️' : '🌙'} sibling coming soon.`);
    import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
    return;
  }

  // 4. Spawn next merchant when timer fires and nobody is active
  if (!m.active && m.nextVisitAt > 0 && now >= m.nextVisitAt) {
    const who = m.nextMerchant || (Math.random() < 0.5 ? 'mochi' : 'moto');
    m.active         = who;
    m.arrivedAt      = now;
    m.nextVisitAt    = 0;
    m.nextMerchant   = null;
    if (who === 'mochi') {
      const items = ['helios', 'sundial', 'lightleaf', 'photosynth'];
      m.activeItemId   = items[Math.floor(Math.random() * items.length)];
      m.activeRiddleId = null;
    } else {
      const riddles = ['flash_stone', 'wealth_bowl', 'seeds_twice', 'fits_sits'];
      m.activeRiddleId = riddles[Math.floor(Math.random() * riddles.length)];
      m.activeItemId   = null;
    }
    saveState();
    const icon = who === 'mochi' ? '☀️' : '🌙';
    const name = who === 'mochi' ? 'Mochi' : 'Moto';
    toast(`${icon} ${name} has arrived at your farm!`);
    import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
    return;
  }

  // 5. Bootstrap: schedule first visit when nothing is pending
  if (!m.active && !m.nextVisitAt && !m.effect) {
    m.nextVisitAt = now + randInt(VISIT_WINDOW_MIN, VISIT_WINDOW_MAX);
    saveState();
  }
}

// ── ACTIONS ───────────────────────────────────────────────

/** Player dismisses the merchant — saves them for later. */
export function dismissMerchant() {
  const m = state.merchant;
  if (!m.active) return;
  // Merchant stays 'active' (offer is saved) — icon remains tappable.
  // We just close the modal. No timer change.
  saveState();
  import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
}

/** Player declines the merchant entirely — sends sibling. */
export function declineMerchant() {
  const m   = state.merchant;
  const who = m.active;
  if (!who) return;
  m.active = null;
  const sibling = who === 'mochi' ? 'moto' : 'mochi';
  m.nextMerchant = sibling;
  m.nextVisitAt  = Date.now() + randInt(SIBLING_DELAY_MIN, SIBLING_DELAY_MAX);
  saveState();
  import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
}

/** Player buys a Mochi item. */
export function buyMochiItem(itemId) {
  const m    = state.merchant;
  const item = MOCHI_ITEMS.find(i => i.id === itemId);
  if (!item || m.active !== 'mochi') return;

  const cost = mochiCost();
  if (state.coins < cost) {
    toast(`Need 🪙${cost.toLocaleString()} for Mochi's wares!`);
    return;
  }

  state.coins -= cost;

  // Apply effect
  if (item.effect === 'sundial') {
    // Instant: reduce all planted timers by 10 minutes
    const tenMin = 10 * 60 * 1000;
    let shifted = 0;
    state.plots.forEach(p => {
      if (p.state === 'planted' && p.plantedAt) {
        p.plantedAt = p.plantedAt - tenMin; // makes crop appear older → done sooner
        shifted++;
      }
    });
    toast(`⏳ Sundial Dust! ${shifted} crop${shifted !== 1 ? 's' : ''} aged by 10 minutes.`);
  } else {
    // Timed effect
    m.effect = {
      id:        item.effect,
      label:     item.name,
      icon:      item.icon,
      expiresAt: Date.now() + item.duration,
    };
    toast(`${item.icon} ${item.name} active for ${item.duration / 3600000 < 1 ? (item.duration / 60000) + ' min' : (item.duration / 3600000) + ' hrs'}!`);
  }

  // Dismiss merchant — visit concluded
  m.active = null;
  m.nextVisitAt  = Date.now() + randInt(VISIT_WINDOW_MIN, VISIT_WINDOW_MAX);
  m.nextMerchant = null;

  saveState();
  import('./ui.js').then(({ updateMerchantUI, updateHeader, updateShopUI }) => {
    updateMerchantUI();
    updateHeader();
    updateShopUI();
  });
}

/** Player buys a Moto riddle. Outcome is random, revealed immediately. */
export function buyMotoRiddle(riddleId) {
  const m      = state.merchant;
  const riddle = MOTO_RIDDLES.find(r => r.id === riddleId);
  if (!riddle || m.active !== 'moto') return;

  const cost = Math.floor(mochiCost() / 2);
  if (state.coins < cost) {
    toast(`Need 🪙${cost.toLocaleString()} for Moto's brew!`);
    return;
  }

  state.coins -= cost;

  // 50/50 outcome
  const isGood = Math.random() < 0.5;

  if (isGood) {
    const g = riddle.good;
    if (riddle.effect_good === 'instant_growth') {
      // Instant: age all planted crops to completion
      state.plots.forEach(p => {
        if (p.state === 'planted') p.state = 'ready';
      });
      toast(`⚡ ${g.label}! All crops are ready to harvest!`);
    } else if (riddle.effect_good === 'triple_sell') {
      m.effect = { id: 'triple_sell', label: 'Triple Sell', icon: '💰', usesLeft: 10 };
      toast(`💰 ${g.label}! Next 10 items sell for 3× value!`);
    } else if (riddle.effect_good === 'miracle_harvest') {
      m.effect = { id: 'miracle_harvest', label: 'Miracle Harvest', icon: '🌱', expiresAt: Date.now() + HELIOS_DURATION };
      toast(`🌱 ${g.label}! +5 yield per harvest for 2 hours!`);
    } else if (riddle.effect_good === 'void_barn') {
      m.effect = { id: 'void_barn', label: 'Void Barn', icon: '🏚️', expiresAt: Date.now() + VOID_BARN_DURATION };
      toast(`🏚️ ${g.label}! Unlimited barn for 2 hours!`);
    }
  } else {
    const b = riddle.bad;
    if (riddle.effect_bad === 'tax') {
      // Instant
      const tax = Math.floor(state.coins * 0.15);
      state.coins = Math.max(0, state.coins - tax);
      toast(`💸 ${b.label}! Moto took ${tax.toLocaleString()} 🪙…`);
    } else if (riddle.effect_bad === 'instant_growth') {
      // Frozen soil
      const frozenNow = Date.now();
      m.effect = { id: 'frozen', label: 'Frozen Soil', icon: '🧊', expiresAt: frozenNow + FROZEN_DURATION, frozenAt: frozenNow };
      toast(`🧊 ${b.label}! All timers frozen for 30 min!`);
    } else {
      // Other timed debuffs
      m.effect = { id: riddle.effect_bad, label: b.label, icon: '💀', expiresAt: Date.now() + (riddle.duration_bad || FROZEN_DURATION) };
      toast(`${b.label} activated… good luck.`);
    }
  }

  // Store outcome for reveal modal
  m.motoOutcome = {
    riddleId,
    isGood,
    label:   isGood ? riddle.good.label : riddle.bad.label,
    desc:    isGood ? riddle.good.desc  : riddle.bad.desc,
    icon:    isGood ? '🌟' : '💀',
    flavor:  isGood
      ? 'The brew shimmers gold. Fortune smiles!'
      : 'The brew turns black. Moto grins. "Interesting…"',
  };

  // Dismiss merchant
  m.active = null;
  m.nextVisitAt  = Date.now() + randInt(VISIT_WINDOW_MIN, VISIT_WINDOW_MAX);
  m.nextMerchant = null;

  saveState();
  import('./ui.js').then(({ updateMerchantUI, renderGrid, updateHeader, updateShopUI }) => {
    updateMerchantUI();
    renderGrid();
    updateHeader();
    updateShopUI();
  });
}

/** Clear the stored Moto outcome (after player dismisses reveal). */
export function clearMotoOutcome() {
  state.merchant.motoOutcome = null;
  saveState();
  import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
}

export function mochiCostForDisplay() { return mochiCost(); }
export function motoCostForDisplay()  { return Math.floor(mochiCost() / 2); }
