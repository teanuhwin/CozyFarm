// ── TOWN SQUARE / NPC MODULE ──────────────────────────────
import {
  state, saveState, randInt, formatTime,
} from './state.js';
import { toast, updateTownBadge, renderTownTab } from './ui.js';

// ── NPC DATA ──────────────────────────────────────────────

export const NPC_DATA = {
  kimchi: {
    name: 'Mayor Kimchi',
    role: 'A literal dog. Her human assistant translates her ambitious city planning.',
    sprite: '🐕',
    story: [
      'Woof! (Assistant: The Mayor is dealing with a raccoon-through-the-roof incident at City Hall. She needs your help keeping the town safe.)',
      'Bark! (Assistant: Kimchi is commissioning gold-plated hydrants. Your gloves just got a durability boost — she insisted on it.)',
      'Bark bark! (Assistant: The Mayor has been researching industrial fibers. She says more upgrades are on the way.)',
      'Woof woof! (Assistant: The Twins tried to prank City Hall, but your reinforced gloves helped clean up the Mystery Slime. Kimchi is deeply impressed.)',
      'AWOO! (Assistant: Kimchi declares you the Knight of the Golden Mitts. Your gloves will never break again. She had them blessed.)',
    ],
    bonuses: [
      'Gloves durability: 30 uses',
      'Gloves durability: 40 uses',
      'Gloves durability: 50 uses',
      'Gloves durability: 60 uses',
      '✨ ULTIMATE: Gloves never break + 80% seed recovery!',
    ],
    requests: [
      { type: 'coin', text: 'Woof! (Assistant: The Mayor is commissioning a gold-plated fire hydrant for the park. It costs {qty} 🪙.)' },
      { type: 'crop', cropKey: 'corn', text: "Bark! (Assistant: We are hosting the 'Yellow Festival.' Please provide {qty} 🌽 Corn for the decor.)" },
      { type: 'combo', cropKey: 'pumpkin', text: "Awooo! (Assistant: The Mayor is building a 'Gourd Palace.' We require {cropQty} 🎃 Pumpkins and {coinQty} 🪙.)" },
    ],
  },
  kalbi: {
    name: 'Old Man Kalbi',
    role: 'Grumpy but sweet. He farms the old-fashioned way and refuses to change.',
    sprite: '👴',
    story: [
      "The local bakery is using fake flour and I won't stand for it. I need your wheat to prove my sourdough is still the best.",
      "That bakery tried to buy me out. I refused — and now we're entered in the Gainesville Harvest Festival together. Your wheat will win us that ribbon.",
      "We won the Blue Ribbon! Ha! Your wheat made all the difference. I'm telling everyone who'll listen.",
      "A massive storm nearly took the barn. But with your help, the old ways survived. I won't forget this.",
      "You're my official farming protégé now. Here's everything I know about Heritage Wheat — it's yours.",
    ],
    bonuses: [
      'Wheat sell price +10%',
      'Wheat: 10% chance for +1 extra yield',
      'Wheat sell price +25%',
      'Wheat: 20% chance for +2 extra yield',
      '✨ ULTIMATE: Wheat grows 50% faster + immune to weather destruction!',
    ],
    requests: [
      { type: 'crop', cropKey: 'wheat', text: 'The local bakery is out of flour! I need {qty} 🌾 Wheat or there will be no toast in this town tomorrow!' },
      { type: 'coin', text: "My tractor's engine fell out. It's an antique, and the parts cost {qty} 🪙. Help an old man out?" },
      { type: 'combo', cropKey: 'wheat', text: 'Fixing the barn roof before the storm. Bring me {cropQty} 🌾 Wheat and {coinQty} 🪙 for the shingles.' },
    ],
  },
  ellie: {
    name: 'Lady Ellie',
    role: 'High society. She views your farm as her personal gourmet pantry.',
    sprite: '👒',
    story: [
      "My catering team was short on earthy delicacies. You saved the gala — barely. I suppose I'm grateful.",
      "I've decided the town square is far too peasant-like. I bought the fountain. You're welcome, everyone.",
      "The Queen herself is visiting. Your truffles were the star of the private tasting. She asked for your name.",
      "A rival socialite tried to outshine me. Your fine goods won the social war. I don't forget favors.",
      "You are now the Royal Purveyor of Luxury. I've arranged it so your truffles sell for 2.2× their normal price. Forever.",
    ],
    bonuses: [
      'Truffle sell price +10%',
      'Truffle grow speed +10%',
      'Truffle sell price +25%',
      'Truffle grow speed +20%',
      '✨ ULTIMATE: Truffles always yield min. 2 + sell for 2.2× price!',
    ],
    requests: [
      { type: 'crop', cropKey: 'truffle', text: "My catering team needs {qty} 🍄 Truffles for the Royal Gala. Don't be late; the Queen is coming." },
      { type: 'coin', text: "I've decided to buy the local fountain. It's a steal at {qty} 🪙. Do handle the transaction for me." },
      { type: 'combo', cropKey: 'truffle', text: 'A private dinner for the elite. I need {cropQty} 🍄 Truffles and {coinQty} 🪙 for the fine crystal.' },
    ],
  },
  twins: {
    name: 'Mason & Jason',
    role: 'Chaotic children. Their "projects" have become increasingly expensive and large-scale.',
    sprite: '👫',
    story: [
      "We're building a fortress made entirely of kernels. It's going to be EPIC. We just need your corn.",
      "We accidentally rented a hot air balloon. The pilot wants a lot to land. It's… complicated.",
      "The Volcano Popcorn experiment technically failed, but the resulting Chaos Corn grows way faster now. Worth it.",
      "The Mystery Slime prank required wheat and a lot of coins. Kimchi was NOT happy. We regret nothing.",
      "We hereby declare you an honorary Chaos Child! Your corn grows in half the time now. And sometimes it just shows up already watered. Don't ask us how.",
    ],
    bonuses: [
      'Corn sell price +15%',
      'Permanent +1 Corn yield',
      'Corn sell price +30%',
      '10% chance for Corn to grow instantly',
      '✨ ULTIMATE: Corn growth time halved + 60% chance pre-watered when planted!',
    ],
    requests: [
      { type: 'crop', cropKey: 'corn', text: "We're building a fortress made of kernels! We need {qty} 🌽 Corn right now!" },
      { type: 'coin', text: "We accidentally 'rented' a hot air balloon and can't get down. The pilot wants {qty} 🪙 to land." },
      { type: 'combo', cropKey: 'wheat', text: "The ultimate prank. We need {cropQty} 🌾 Wheat and {coinQty} 🪙 for the 'mystery slime' budget!" },
    ],
  },
  maru: {
    name: 'Hunter Maru',
    role: 'A literal cat. He speaks in meows, translated by his loyal (and slightly sarcastic) crow assistant.',
    sprite: '🐱',
    story: [
      "Meow. (Crow: The tracking pig went on strike. He bribed it back with truffles. Don't ask.)",
      "Hiss. (Crow: He's claimed an abandoned cabin as his No Dogs Allowed sanctuary. You funded the deed.)",
      "Mrow. (Crow: Maru is preparing for the Great Freeze. Your provisions are keeping him fed through the long prowl.)",
      "Mrrrow! (Crow: During a storm, he taught you how pumpkins grow faster in bad weather. I did most of the explaining, honestly.)",
      "PRRR. (Crow: He performed the legendary Shadow Pounce. Harvesting one pumpkin now boosts all others growing nearby.)",
    ],
    bonuses: [
      'Pumpkin sell price +15%',
      '10% chance to find a Truffle when harvesting Pumpkin',
      'Pumpkin sell price +40%',
      'Pumpkins grow 30% faster during bad weather',
      '✨ ULTIMATE: Harvesting a Pumpkin queues +1 yield on all adjacent growing Pumpkins!',
    ],
    requests: [
      { type: 'crop', cropKey: 'truffle', text: "Meow! (Crow: The fuzz-ball says he's stockpiling for the Great Freeze. {qty} 🍄 Truffles should keep his belly full.)" },
      { type: 'coin', text: 'Hiss! (Crow: Someone stepped on his tail. He needs {qty} 🪙 to buy that cabin and turn it into a sanctuary.)' },
      { type: 'combo', cropKey: 'truffle', text: "Mrow? (Crow: He's going on a long-distance prowl. Bring {cropQty} 🍄 Truffles and {coinQty} 🪙 for provisions.)" },
    ],
  },
  cinna: {
    name: 'Herbalist Cinna',
    role: 'Calm and medicinal. She runs a large-scale community apothecary.',
    sprite: '🌿',
    story: [
      "A town-wide cold has broken out. I'm making soothing wheat compresses for everyone. Thank you for the supply.",
      "The community greenhouse is underway. This will ensure no one goes without medicine through winter.",
      "I've discovered a Miracle Cure — it required corn and advanced distillation equipment you helped fund.",
      "You've mastered the Conservationist technique. Your water hose is now dramatically more efficient.",
      "I'm granting you the Perpetual Rain blessing. Your water now covers a wide area and crops grow at lightning speed.",
    ],
    bonuses: [
      'Water speedup increased to 45%',
      'Water Hose cost reduced to 140 🪙',
      'Water speedup increased to 60%',
      '20% chance for Water Hose to be free',
      '✨ ULTIMATE: Water 70% faster + single Water covers a 3×3 area!',
    ],
    requests: [
      { type: 'crop', cropKey: 'wheat', text: 'The whole town has the sniffles. I need {qty} 🌾 Wheat to make soothing herbal compresses.' },
      { type: 'coin', text: "I'm building a community greenhouse. The glass alone costs {qty} 🪙." },
      { type: 'combo', cropKey: 'corn', text: 'A new miracle cure! It requires {cropQty} 🌽 Corn and {coinQty} 🪙 for the distillation equipment.' },
    ],
  },
  kola: {
    name: 'Wizard Kola',
    role: 'Eccentric. His requests involve massive amounts of resources for "cosmic stability."',
    sprite: '🧙',
    story: [
      "The Moon is hungry. It has requested pumpkins. Do not ask why the Moon eats. Just bring them.",
      "I tried to buy a star. It turns out, stars are expensive. Thank you for covering the down payment.",
      "A rift to the Truffle Dimension opened. Your resources stabilized it before the town was overrun by fungi.",
      "I accidentally turned my gold into lead. You funded the reversal spell. In return, here's some Mystic Residue.",
      "This is my Magic Dust — a fertilizer so potent, it can warp time itself to finish your crops instantly.",
    ],
    bonuses: [
      'Fertilizer yield increased to +3',
      'Big Fertilizer cost reduced to 190 🪙',
      'Fertilizer yield increased to +5',
      '20% chance for Big Fertilizer to be free',
      '✨ ULTIMATE: Both fertilizers give +5 yield + 25% chance Fertilizer triggers instant growth!',
    ],
    requests: [
      { type: 'crop', cropKey: 'pumpkin', text: 'The Moon is hungry. It has requested {qty} 🎃 Pumpkins. Do not ask why the Moon eats.' },
      { type: 'coin', text: "I tried to buy a star. Turns out, they are expensive. I'm short {qty} 🪙 on the down payment." },
      { type: 'combo', cropKey: 'truffle', text: 'Opening a portal to the Truffle Dimension. I need {cropQty} 🍄 Truffles and {coinQty} 🪙 to stabilize the rift.' },
    ],
  },
};

export const NPC_ORDER = ['kimchi', 'kalbi', 'ellie', 'twins', 'maru', 'cinna', 'kola'];
export const CROP_EMOJI = { wheat:'🌾', corn:'🌽', pumpkin:'🎃', truffle:'🍄' };

// Lifetime coins required for merchants to appear
export const MERCHANT_UNLOCK_COINS = 10000;

const NPC_COOLDOWN_MIN = 1 * 60 * 1000;
const NPC_COOLDOWN_MAX = 10 * 60 * 1000;
const NPC_COOLDOWN_UNLOCKED_MIN = 1 * 60 * 1000;
const NPC_COOLDOWN_UNLOCKED_MAX = 15 * 60 * 1000;

const REQ_CROP_MIN = 30, REQ_CROP_MAX = 80;
const CAPSTONE_COIN_REWARD = 15000;
const CAPSTONE_RESOURCE_AMT = 100;

// ── AFFINITY HELPERS ──────────────────────────────────────

export function affinityLevel(npcId) {
  return Math.min(5, Math.floor((state.npcs[npcId]?.affinity || 0) / 3));
}

export function bonusForLevel(npcId, level) {
  if (level <= 0) return '';
  const bonuses = NPC_DATA[npcId]?.bonuses || [];
  return bonuses[level - 1] || '';
}

export function activeBonusText(npcId) {
  return bonusForLevel(npcId, affinityLevel(npcId));
}

export function currentStoryText(npcId) {
  const aff = state.npcs[npcId]?.affinity || 0;
  const storyIdx = Math.min(4, Math.floor(aff / 3));
  return NPC_DATA[npcId]?.story[storyIdx] || '';
}

// ── CORE HELPERS ──────────────────────────────────────────

export function isTownUnlocked() {
  return state.rows >= 6 && state.cols >= 6 && state.barnLevel >= 3;
}

export function unlockedNpcIds() {
  return (state.unlockedNpcs || ['kimchi']).filter(id => NPC_DATA[id]);
}

export function migrateNpcs() {
  if (!state.npcs)         state.npcs         = {};
  if (!state.unlockedNpcs) state.unlockedNpcs = ['kimchi'];
  NPC_ORDER.forEach(id => {
    if (!state.npcs[id]) state.npcs[id] = { affinity: 0, request: null, nextRequestAt: 0, expanded: false };
    if (state.npcs[id].nextRequestAt === undefined) state.npcs[id].nextRequestAt = 0;
    if (state.npcs[id].affinity      === undefined) state.npcs[id].affinity      = 0;
    if (state.npcs[id].expanded      === undefined) state.npcs[id].expanded      = false;
  });
}

export function generateRequest(npcId) {
  const npcState = state.npcs[npcId];
  const npc = NPC_DATA[npcId];

  // Capstone: affinity == 14 → next completion hits 15 (max level 5)
  if (npcState.affinity === 14) {
    return generateCapstoneRequest(npcId);
  }

  const template = npc.requests[randInt(0, npc.requests.length - 1)];
  const req = { type: template.type, cropKey: template.cropKey || null, coins: 0, crop: 0, text: '', isCapstone: false };

  const lvl = affinityLevel(npcId);
  const coinMin = lvl <= 1 ? 3000 : lvl <= 3 ? 4500 : 5500;
  const coinMax = lvl <= 1 ? 4500 : lvl <= 3 ? 7000 : 8000;

  if (template.type === 'crop') {
    req.crop = randInt(REQ_CROP_MIN, REQ_CROP_MAX);
    req.text = template.text.replace('{qty}', req.crop);
  } else if (template.type === 'coin') {
    req.coins = randInt(coinMin, coinMax);
    req.text  = template.text.replace('{qty}', req.coins.toLocaleString());
  } else {
    req.crop  = randInt(REQ_CROP_MIN, REQ_CROP_MAX);
    req.coins = randInt(coinMin, coinMax);
    req.text  = template.text
      .replace('{cropQty}', req.crop)
      .replace('{qty}',     req.crop)
      .replace('{coinQty}', req.coins.toLocaleString());
  }
  return req;
}

// Specialty crop each NPC requests for their capstone
const CAPSTONE_CROP_MAP = {
  kimchi: 'corn', kalbi: 'wheat', ellie: 'truffle',
  twins: 'corn', maru: 'pumpkin', cinna: 'wheat', kola: 'truffle',
};

function generateCapstoneRequest(npcId) {
  const cropKey  = CAPSTONE_CROP_MAP[npcId] || 'wheat';
  const coinCost = CAPSTONE_COIN_COSTS[npcId] || CAPSTONE_COIN_REWARD;
  return {
    type: 'combo', cropKey, crop: CAPSTONE_RESOURCE_AMT, coins: coinCost, isCapstone: true,
    text: `⭐ FINAL REQUEST: This is it — everything I've been building toward. I need 100 ${CROP_EMOJI[cropKey]} and ${coinCost.toLocaleString()} 🪙. What comes next will stay with you forever.`,
  };
}

/**
 * Unlock the next NPC in order, but only if the previous NPC has
 * at least 3 affinity points (i.e. 3 quests fulfilled).
 */
function tryUnlockNextNpc() {
  const unlocked = state.unlockedNpcs || ['kimchi'];
  const next = NPC_ORDER.find(id => !unlocked.includes(id));
  if (!next) return;

  // Find the NPC that was just before `next` in the order
  const prevIdx = NPC_ORDER.indexOf(next) - 1;
  if (prevIdx >= 0) {
    const prevId = NPC_ORDER[prevIdx];
    const prevAffinity = state.npcs[prevId]?.affinity || 0;
    // Require at least 3 completed quests (affinity >= 3) before unlocking next
    if (prevAffinity < 3) return;
  }

  state.unlockedNpcs.push(next);
  state.npcs[next].nextRequestAt = 0;
  setTimeout(() => toast(`🏘️ ${NPC_DATA[next].name} has moved to town!`), 600);
}

export function canFulfill(npcId) {
  const req = state.npcs[npcId].request;
  if (!req) return false;
  const hasCoins = req.coins === 0 || state.coins >= req.coins;
  const hasCrop  = req.crop  === 0 || (state[req.cropKey] || 0) >= req.crop;
  return hasCoins && hasCrop;
}

// ── ACTIONS ───────────────────────────────────────────────

export function tickNpcs() {
  if (!isTownUnlocked()) return;
  migrateNpcs();
  let changed = false;
  unlockedNpcIds().forEach(id => {
    const npc = state.npcs[id];
    if (npc.affinity >= 15) return; // maxed out
    if (!npc.request && Date.now() >= npc.nextRequestAt) {
      npc.request = generateRequest(id);
      changed = true;
      toast(`📬 New request from ${NPC_DATA[id].name}!`);
    }
  });
  if (changed) {
    saveState();
    updateTownBadge();
    const panel = document.getElementById('tab-town');
    if (panel && panel.classList.contains('active')) renderTownTab();
  }
}

export function toggleNpcExpanded(npcId) {
  const npc = state.npcs[npcId];
  if (!npc) return;
  npc.expanded = !npc.expanded;
  const panel = document.getElementById('tab-town');
  if (panel && panel.classList.contains('active')) renderTownTab();
}

export function deliverRequest(npcId) {
  const npc = state.npcs[npcId];
  if (!npc || !npc.request) return;
  const req = npc.request;

  if (req.crop > 0 && (state[req.cropKey] || 0) < req.crop) {
    toast(`Not enough ${CROP_EMOJI[req.cropKey]}!`); return;
  }
  if (req.coins > 0 && state.coins < req.coins) {
    toast('Not enough 🪙!'); return;
  }

  if (req.crop  > 0) state[req.cropKey] -= req.crop;
  if (req.coins > 0) state.coins        -= req.coins;

  const prevLevel = Math.min(5, Math.floor(npc.affinity / 3));

  npc.affinity = Math.min(15, npc.affinity + 1);
  npc.request  = null;

  const newLevel = Math.min(5, Math.floor(npc.affinity / 3));
  const leveledUp = newLevel > prevLevel;

  const allUnlocked = (state.unlockedNpcs || []).length >= NPC_ORDER.length;
  const cdMin = allUnlocked ? NPC_COOLDOWN_UNLOCKED_MIN : NPC_COOLDOWN_MIN;
  const cdMax = allUnlocked ? NPC_COOLDOWN_UNLOCKED_MAX : NPC_COOLDOWN_MAX;
  npc.nextRequestAt = npc.affinity >= 15 ? Infinity : Date.now() + randInt(cdMin, cdMax);

  tryUnlockNextNpc();
  saveState();

  import('./ui.js').then(({ updateHeader, updateShopUI, updateTownBadge: utb, renderTownTab: rtt }) => {
    updateHeader(); updateShopUI(); utb(); rtt();
  });

  if (leveledUp && newLevel > 0) {
    const bonus = bonusForLevel(npcId, newLevel);
    const star  = newLevel === 5 ? '✨' : '💛';
    setTimeout(() => toast(`${star} ${NPC_DATA[npcId].name} Lv.${newLevel}! ${bonus}`), 300);
  } else {
    toast(`💛 ${NPC_DATA[npcId].name}: ${npc.affinity}/15 affinity`);
  }
}

// ── STAT GETTERS (consumed by main.js) ───────────────────

export function getGlovesUses() {
  const lvl = affinityLevel('kimchi');
  if (lvl >= 5) return Infinity;
  if (lvl >= 4) return 60;
  if (lvl >= 3) return 50;
  if (lvl >= 2) return 40;
  if (lvl >= 1) return 30;
  return null;
}

export function getGlovesChance() {
  return affinityLevel('kimchi') >= 5 ? 0.80 : null;
}

export function getWheatSellMult() {
  const lvl = affinityLevel('kalbi');
  if (lvl >= 3) return 1.25;
  if (lvl >= 1) return 1.10;
  return 1.0;
}

export function getWheatYieldBonus() {
  const lvl = affinityLevel('kalbi');
  if (lvl >= 4) return { chance: 0.20, extra: 2 };
  if (lvl >= 2) return { chance: 0.10, extra: 1 };
  return null;
}

export function getTruffleSellPrice(base) {
  const lvl = affinityLevel('ellie');
  if (lvl >= 5) return Math.round(base * 2.20);
  if (lvl >= 3) return Math.round(base * 1.25);
  if (lvl >= 1) return Math.round(base * 1.10);
  return base;
}

export function getTruffleGrowMult() {
  const lvl = affinityLevel('ellie');
  if (lvl >= 4) return 0.80;
  if (lvl >= 2) return 0.90;
  return 1.0;
}

export function getTruffleMinYield() {
  return affinityLevel('ellie') >= 5 ? 2 : 1;
}

export function getCornYieldBonus() {
  return affinityLevel('twins') >= 2 ? 1 : 0;
}

export function getCornSellMult() {
  const lvl = affinityLevel('twins');
  if (lvl >= 3) return 1.30;
  if (lvl >= 1) return 1.15;
  return 1.0;
}

export function getCornGrowMult() {
  const lvl = affinityLevel('twins');
  if (lvl >= 5) return 0.50;
  return 1.0;
}

/** Roll the L4 10% instant-grow chance once. Call only at plant time. */
export function rollCornInstant() {
  return affinityLevel('twins') >= 4 && Math.random() < 0.10;
}

export function getPumpkinSellMult() {
  const lvl = affinityLevel('maru');
  if (lvl >= 3) return 1.40;
  if (lvl >= 1) return 1.15;
  return 1.0;
}

export function getPumpkinWeatherMult() {
  return affinityLevel('maru') >= 4 ? 0.70 : 1.0;
}

export function getWaterSpeedup() {
  const lvl = affinityLevel('cinna');
  if (lvl >= 5) return 0.30;
  if (lvl >= 3) return 0.40;
  if (lvl >= 1) return 0.55;
  return null;
}

export function getWaterHoseCost(base) {
  const lvl = affinityLevel('cinna');
  if (lvl >= 4 && Math.random() < 0.20) return 0;
  if (lvl >= 2) return 140;
  return base;
}

/** Returns the radius of single-water area effect (0 = just this plot, 1 = 3x3) */
export function getWaterAreaSize() {
  return affinityLevel('cinna') >= 5 ? 1 : 0;
}
/** @deprecated use getWaterAreaSize */
export function getWaterHoseAreaBoost() {
  return affinityLevel('cinna') >= 5;
}

export function getFertYield() {
  const lvl = affinityLevel('kola');
  if (lvl >= 3) return 5;
  if (lvl >= 1) return 3;
  return null;
}

export function getBigFertCost(base) {
  const lvl = affinityLevel('kola');
  if (lvl >= 4 && Math.random() < 0.20) return 0;
  if (lvl >= 2) return 190;
  return base;
}

export function getBigFertYield() {
  const lvl = affinityLevel('kola');
  if (lvl >= 3) return 5;
  if (lvl >= 1) return 3;
  return 2;
}

export function getFertInstantChance() {
  return affinityLevel('kola') >= 5 ? 0.25 : 0;
}

export function getWheatWeatherImmune() {
  return affinityLevel('kalbi') >= 5;
}

// F. Scaled capstone coin costs per NPC (later NPCs = higher cost)
export const CAPSTONE_COIN_COSTS = {
  kimchi: 15000,
  kalbi:  15000,
  ellie:  20000,
  twins:  20000,
  maru:   25000,
  cinna:  35000,
  kola:   50000,
};
