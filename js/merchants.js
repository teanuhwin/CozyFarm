// ── MERCHANT MODULE ───────────────────────────────────────
// Mochi (☀️) and Moto (🌙) — roaming merchant siblings
import { state, saveState, randInt } from './state.js';
import { MERCHANT_UNLOCK_COINS } from './npcs.js';
import { toast } from './ui.js';

function mochiCost() {
  const plots = state.rows * state.cols;
  const gridBase = plots <= 4 ? 500 : plots <= 9 ? 1000 : plots <= 16 ? 2000 : plots <= 25 ? 3500 : 5000;
  const lifetimeBased = Math.floor((state.lifetimeCoins || 0) * 0.005);
  return Math.max(gridBase, Math.min(lifetimeBased, 50000));
}

const MERCHANT_STAY_MS   = 10 * 60 * 1000;
const VISIT_WINDOW_MIN   = 30 * 60 * 1000;
const VISIT_WINDOW_MAX   = 60 * 60 * 1000;
const SIBLING_DELAY_MIN  = 20 * 60 * 1000;
const SIBLING_DELAY_MAX  = 30 * 60 * 1000;

const HELIOS_DURATION    = 30 * 60 * 1000;
const LIGHTLEAF_DURATION = 30 * 60 * 1000;
const PHOTOSYNTH_DURATION= 30 * 60 * 1000;
const VOID_BARN_DURATION = 1 * 60 * 60 * 1000;
const FROZEN_DURATION    = 30 * 60 * 1000;
const MIRACLE_DURATION   = 1 * 60 * 60 * 1000;
const STICKY_DURATION    = 1 * 60 * 60 * 1000;

export const MOCHI_ITEMS = [
  { id:'helios',     name:'Helios Serum',       icon:'🌟', desc:'Market Boom: All sell prices +50% for 30 minutes.',                   effect:'helios',     duration:HELIOS_DURATION },
  { id:'sundial',    name:'Sundial Dust',        icon:'⏳', desc:'Time Warp: All current crop timers reduced by 15 minutes instantly.', effect:'sundial',    duration:null },
  { id:'lightleaf',  name:'Light-Leaf Oil',      icon:'🫙', desc:'Weightless Harvest: Crops take 0 barn space for 30 minutes.',        effect:'lightleaf',  duration:LIGHTLEAF_DURATION },
  { id:'photosynth', name:'Photosynthesis',      icon:'🌿', desc:'Bountiful Harvest: Every crop harvested gives +3 extra yield for 30 minutes.', effect:'photosynth', duration:PHOTOSYNTH_DURATION },
];

export const MOTO_RIDDLES = [
  { id:'flash_stone', riddle:'"Fast as a flash, or slow as a stone?"',      good:{ label:'⚡ Instant Growth',  desc:'All planted crops finish growing immediately.' }, bad:{ label:'🧊 Frozen Soil',       desc:'All crop timers pause for 30 minutes.' },              effect_good:'instant_growth',  effect_bad:'frozen',            duration_bad:FROZEN_DURATION },
  { id:'wealth_bowl', riddle:'"Wealth for the soul, or a hole in the bowl?"',good:{ label:'💰 Triple Sell',     desc:'Next 30 items sold go for 3× value.' },            bad:{ label:'💸 Tax Man',           desc:'Moto "accidentally" takes 30% of your current coins.' },effect_good:'triple_sell',     effect_bad:'tax',               duration_bad:null },
  { id:'seeds_twice', riddle:'"Seeds that bloom twice, or seeds that turn to ice?"',good:{ label:'🌱 Miracle Harvest', desc:'Every harvest gives +5 yield for 1 hour.' },  bad:{ label:'🥶 Barren Earth',      desc:'Moto destroys 3 random rows of crops instantly!' },    effect_good:'miracle_harvest', effect_bad:'barren_destruction',duration_bad:null },
  { id:'fits_sits',   riddle:'"Everything fits, or everything sits?"',       good:{ label:'🏚️ Void Barn',      desc:'Unlimited barn capacity for 1 hour.' },             bad:{ label:'🐌 Sticky Fingers',    desc:'One harvest every 5 seconds for 1 hour.' },            effect_good:'void_barn',       effect_bad:'sticky',            duration_bad:STICKY_DURATION },
];

export function isMerchantUnlocked() {
  return (state.lifetimeCoins || 0) >= MERCHANT_UNLOCK_COINS;
}

export function getMerchantEffect() { return state.merchant?.effect || null; }

export function effectActive(id) {
  const eff = getMerchantEffect();
  if (!eff) return false;
  if (eff.id !== id) return false;
  if (eff.expiresAt && Date.now() >= eff.expiresAt) return false;
  if (eff.usesLeft !== undefined && eff.usesLeft <= 0) return false;
  return true;
}

export function getMerchantSellMult() {
  if (effectActive('helios'))      return 1.50;
  if (effectActive('triple_sell')) return 3.0;
  return 1.0;
}

export function isBarnWeightless()   { return effectActive('lightleaf') || effectActive('void_barn'); }
export function getMiracleYield()    { if (effectActive('miracle_harvest')) return 5; if (effectActive('photosynth')) return 3; return 0; }
export function isTimerFrozen()      { return effectActive('frozen'); }
export function isBarrenEarth()      { return false; }
export function isPhotosynthActive() { return effectActive('photosynth'); }
export function getStickyDelay()     { return effectActive('sticky') ? 5000 : 0; }

export function consumeTripleSellUse() {
  const eff = getMerchantEffect();
  if (!eff || eff.id !== 'triple_sell' || eff.usesLeft <= 0) return 1.0;
  eff.usesLeft--;
  if (eff.usesLeft <= 0) { state.merchant.effect = null; toast('💸 Triple Sell expired — all 30 items sold!'); }
  saveState();
  return 3.0;
}

export function tickMerchants() {
  if (!isMerchantUnlocked()) return;
  const m = state.merchant;
  const now = Date.now();

  if (m.effect && m.effect.expiresAt && now >= m.effect.expiresAt) {
    const label = m.effect.label || 'Effect';
    const wasFrozen = m.effect.id === 'frozen' && m.effect.frozenAt;
    const frozenDuration = wasFrozen ? (m.effect.expiresAt - m.effect.frozenAt) : 0;
    m.effect = null;
    if (frozenDuration > 0) {
      state.plots.forEach(p => { if (p.state === 'planted' && p.plantedAt) p.plantedAt += frozenDuration; });
    }
    if (!m.nextVisitAt || m.nextVisitAt <= now) m.nextVisitAt = now + randInt(VISIT_WINDOW_MIN, VISIT_WINDOW_MAX);
    saveState();
    toast(`⏰ ${label} has worn off.`);
    import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
    return;
  }

  if (m.effect) return;

  if (m.active && m.arrivedAt > 0 && now - m.arrivedAt >= MERCHANT_STAY_MS) {
    const who = m.active;
    const icon = who === 'mochi' ? '☀️' : '🌙';
    const name = who === 'mochi' ? 'Mochi' : 'Moto';
    const sibling = who === 'mochi' ? 'moto' : 'mochi';
    m.active = null; m.arrivedAt = 0; m.activeItemId = null; m.activeRiddleId = null;
    m.nextMerchant = sibling;
    m.nextVisitAt  = now + randInt(SIBLING_DELAY_MIN, SIBLING_DELAY_MAX);
    saveState();
    toast(`${icon} ${name} left — no time to wait! ${sibling === 'mochi' ? '☀️' : '🌙'} sibling coming soon.`);
    import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
    return;
  }

  if (!m.active && m.nextVisitAt > 0 && now >= m.nextVisitAt) {
    const who = m.nextMerchant || (Math.random() < 0.5 ? 'mochi' : 'moto');
    m.active = who; m.arrivedAt = now; m.nextVisitAt = 0; m.nextMerchant = null;
    if (who === 'mochi') {
      const items = ['helios','sundial','lightleaf','photosynth'];
      m.activeItemId = items[Math.floor(Math.random() * items.length)];
      m.activeRiddleId = null;
    } else {
      const riddles = ['flash_stone','wealth_bowl','seeds_twice','fits_sits'];
      m.activeRiddleId = riddles[Math.floor(Math.random() * riddles.length)];
      m.activeItemId = null;
    }
    saveState();
    const icon = who === 'mochi' ? '☀️' : '🌙';
    const name = who === 'mochi' ? 'Mochi' : 'Moto';
    toast(`${icon} ${name} has arrived at your farm!`);
    import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
    return;
  }

  if (!m.active && !m.nextVisitAt && !m.effect) {
    m.nextVisitAt = now + randInt(VISIT_WINDOW_MIN, VISIT_WINDOW_MAX);
    saveState();
  }
}

export function dismissMerchant() {
  const m = state.merchant;
  if (!m.active) return;
  saveState();
  import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
}

export function declineMerchant() {
  const m = state.merchant;
  const who = m.active;
  if (!who) return;
  m.active = null;
  const sibling = who === 'mochi' ? 'moto' : 'mochi';
  m.nextMerchant = sibling;
  m.nextVisitAt  = Date.now() + randInt(SIBLING_DELAY_MIN, SIBLING_DELAY_MAX);
  saveState();
  import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
}

export function buyMochiItem(itemId) {
  const m    = state.merchant;
  const item = MOCHI_ITEMS.find(i => i.id === itemId);
  if (!item || m.active !== 'mochi') return;
  const cost = mochiCost();
  if (state.coins < cost) { toast(`Need 🪙${cost.toLocaleString()} for Mochi's wares!`); return; }
  state.coins -= cost;
  if (item.effect === 'sundial') {
    const fifteenMin = 15 * 60 * 1000;
    let shifted = 0;
    state.plots.forEach(p => { if (p.state === 'planted' && p.plantedAt) { p.plantedAt = p.plantedAt - fifteenMin; shifted++; } });
    m.lastSundialAt = Date.now();
    toast(`⏳ Sundial Dust! ${shifted} crop${shifted !== 1 ? 's' : ''} aged by 15 minutes.`);
  } else {
    m.effect = { id:item.effect, label:item.name, icon:item.icon, expiresAt:Date.now() + item.duration };
    toast(`${item.icon} ${item.name} active for 30 min!`);
  }
  m.active = null;
  m.nextVisitAt  = Date.now() + randInt(VISIT_WINDOW_MIN, VISIT_WINDOW_MAX);
  m.nextMerchant = null;
  saveState();
  import('./ui.js').then(({ updateMerchantUI, updateHeader, updateShopUI }) => { updateMerchantUI(); updateHeader(); updateShopUI(); });
}

export function buyMotoRiddle(riddleId) {
  const m      = state.merchant;
  const riddle = MOTO_RIDDLES.find(r => r.id === riddleId);
  if (!riddle || m.active !== 'moto') return;
  const cost = Math.floor(mochiCost() / 2);
  if (state.coins < cost) { toast(`Need 🪙${cost.toLocaleString()} for Moto's brew!`); return; }
  state.coins -= cost;
  const isGood = Math.random() < 0.5;
  if (isGood) {
    const g = riddle.good;
    if (riddle.effect_good === 'instant_growth') {
      state.plots.forEach(p => { if (p.state === 'planted') p.state = 'ready'; });
      toast(`⚡ ${g.label}! All crops are ready to harvest!`);
    } else if (riddle.effect_good === 'triple_sell') {
      m.effect = { id:'triple_sell', label:'Triple Sell', icon:'💰', usesLeft:30 };
      toast(`💰 ${g.label}! Next 30 items sell for 3× value!`);
    } else if (riddle.effect_good === 'miracle_harvest') {
      m.effect = { id:'miracle_harvest', label:'Miracle Harvest', icon:'🌱', expiresAt:Date.now() + MIRACLE_DURATION };
      toast(`🌱 ${g.label}! +5 yield per harvest for 1 hour!`);
    } else if (riddle.effect_good === 'void_barn') {
      m.effect = { id:'void_barn', label:'Void Barn', icon:'🏚️', expiresAt:Date.now() + VOID_BARN_DURATION };
      toast(`🏚️ ${g.label}! Unlimited barn for 1 hour!`);
    }
  } else {
    const b = riddle.bad;
    if (riddle.effect_bad === 'tax') {
      const tax = Math.floor(state.coins * 0.30);
      state.coins = Math.max(0, state.coins - tax);
      toast(`💸 ${b.label}! Moto took ${tax.toLocaleString()} 🪙 (30%)…`);
    } else if (riddle.effect_bad === 'frozen') {
      const frozenNow = Date.now();
      m.effect = { id:'frozen', label:'Frozen Soil', icon:'🧊', expiresAt:frozenNow + FROZEN_DURATION, frozenAt:frozenNow };
      toast(`🧊 ${b.label}! All timers frozen for 30 min!`);
    } else if (riddle.effect_bad === 'barren_destruction') {
      const rowsToKill = Math.min(3, state.rows);
      const rowIndices = [];
      while (rowIndices.length < rowsToKill) { const r = randInt(0, state.rows-1); if (!rowIndices.includes(r)) rowIndices.push(r); }
      let destroyed = 0;
      rowIndices.forEach(rIdx => {
        for (let c = 0; c < state.cols; c++) {
          const pIdx = rIdx * state.cols + c;
          const p = state.plots[pIdx];
          if (p && p.state !== 'empty' && p.state !== 'flooded') {
            p.state='empty'; p.crop=null; p.plantedAt=null; p.watered=false; p.fertilized=false;
            destroyed++;
          }
        }
      });
      toast(`🥶 ${b.label}! Moto destroyed ${destroyed} crops across 3 rows!`);
    } else {
      m.effect = { id:riddle.effect_bad, label:b.label, icon:'💀', expiresAt:Date.now() + (riddle.duration_bad || STICKY_DURATION) };
      toast(`${b.label} activated… good luck.`);
    }
  }
  m.motoOutcome = { riddleId, isGood, label:isGood?riddle.good.label:riddle.bad.label, desc:isGood?riddle.good.desc:riddle.bad.desc, icon:isGood?'🌟':'💀', flavor:isGood?'The brew shimmers gold. Fortune smiles!':'The brew turns black. Moto grins. "Interesting…"' };
  m.active = null;
  m.nextVisitAt  = Date.now() + randInt(VISIT_WINDOW_MIN, VISIT_WINDOW_MAX);
  m.nextMerchant = null;
  saveState();
  import('./ui.js').then(({ updateMerchantUI, renderGrid, updateHeader, updateShopUI }) => { updateMerchantUI(); renderGrid(); updateHeader(); updateShopUI(); });
}

export function clearMotoOutcome() {
  state.merchant.motoOutcome = null;
  saveState();
  import('./ui.js').then(({ updateMerchantUI }) => updateMerchantUI());
}

export function mochiCostForDisplay() { return mochiCost(); }
export function motoCostForDisplay()  { return Math.floor(mochiCost() / 2); }
