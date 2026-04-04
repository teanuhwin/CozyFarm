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
    requests: [
      { type: 'coin',                      text: 'Woof! (Assistant: The Mayor is commissioning a gold-plated fire hydrant for the park. It costs {qty} 🪙.)' },
      { type: 'crop', cropKey: 'corn',     text: "Bark! (Assistant: We are hosting the 'Yellow Festival.' Please provide {qty} 🌽 Corn for the decor.)" },
      { type: 'combo', cropKey: 'pumpkin', text: "Awooo! (Assistant: The Mayor is building a 'Gourd Palace.' We require {cropQty} 🎃 Pumpkins and {coinQty} 🪙.)" },
    ],
  },
  kalbi: {
    name: 'Old Man Kalbi',
    role: 'Grumpy but sweet. Focused on tradition and high-volume staples.',
    sprite: '👴',
    requests: [
      { type: 'crop', cropKey: 'wheat',   text: 'The local bakery is out of flour! I need {qty} 🌾 Wheat or there will be no toast in this town tomorrow!' },
      { type: 'coin',                      text: "My tractor's engine fell out. It's an antique, and the parts are {qty} 🪙. Help an old man out?" },
      { type: 'combo', cropKey: 'wheat',   text: 'Fixing the barn roof before the storm. Bring me {cropQty} 🌾 Wheat and {coinQty} 🪙 for the shingles.' },
    ],
  },
  ellie: {
    name: 'Lady Ellie',
    role: 'High society. She views your farm as her personal gourmet pantry.',
    sprite: '👒',
    requests: [
      { type: 'crop', cropKey: 'truffle',  text: "My catering team needs {qty} 🍄 Truffles for the Royal Gala. Don't be late; the Queen is coming." },
      { type: 'coin',                      text: "I've decided to buy the local fountain. It's a steal at {qty} 🪙. Do handle the transaction for me." },
      { type: 'combo', cropKey: 'truffle', text: 'A private dinner for the elite. I need {qty} 🍄 Truffles and {coinQty} 🪙 for the fine crystal.' },
    ],
  },
  twins: {
    name: 'Mason & Jason',
    role: 'Chaotic children. Their "projects" have become increasingly expensive and large-scale.',
    sprite: '👫',
    requests: [
      { type: 'crop', cropKey: 'corn',   text: "We're building a fortress made of kernels! We need {qty} 🌽 Corn right now!" },
      { type: 'coin',                    text: "We accidentally 'rented' a hot air balloon and can't get down. The pilot wants {qty} 🪙 to land." },
      { type: 'combo', cropKey: 'wheat', text: "The ultimate prank. We need {cropQty} 🌾 Wheat and {coinQty} 🪙 for the 'mystery slime' budget!" },
    ],
  },
  maru: {
    name: 'Hunter Maru',
    role: 'A literal cat. He speaks in meows and hisses, which are translated by his loyal (and slightly sarcastic) crow assistant.',
    sprite: '🐱',
    requests: [
      { type: 'crop', cropKey: 'truffle',  text: "Meow! (Crow: The fuzz-ball says he's stockpiling for the Great Freeze. {qty} 🍄 Truffles should keep his belly full.)" },
      { type: 'coin',                      text: 'Hiss! (Crow: Someone stepped on his tail. He needs {qty} 🪙 to buy that cabin and turn it into a sanctuary.)' },
      { type: 'combo', cropKey: 'truffle', text: "Mrow? (Crow: He's going on a long-distance prowl. Bring {cropQty} 🍄 Truffles and {coinQty} 🪙 for provisions.)" },
    ],
  },
  cinna: {
    name: 'Herbalist Cinna',
    role: 'Calm and medicinal. She now runs a large-scale apothecary.',
    sprite: '🌿',
    requests: [
      { type: 'crop', cropKey: 'wheat', text: 'The whole town has the sniffles. I need {qty} 🌾 Wheat to make soothing herbal compresses.' },
      { type: 'coin',                   text: "I'm building a community greenhouse. The glass alone is {qty} 🪙." },
      { type: 'combo', cropKey: 'corn', text: 'A new miracle cure! It requires {cropQty} 🌽 Corn and {coinQty} 🪙 for the distillation equipment.' },
    ],
  },
  kola: {
    name: 'Wizard Kola',
    role: 'Eccentric. His requests involve massive amounts of resources for "cosmic stability."',
    sprite: '🧙',
    requests: [
      { type: 'crop', cropKey: 'pumpkin',  text: 'The Moon is hungry. It has requested {qty} 🎃 Pumpkins. Do not ask why the Moon eats.' },
      { type: 'coin',                      text: "I tried to buy a star. Turns out, they are expensive. I'm short {qty} 🪙 on the down payment." },
      { type: 'combo', cropKey: 'truffle', text: 'Opening a portal to the Truffle Dimension. I need {cropQty} 🍄 Truffles and {coinQty} 🪙 to stabilize the rift.' },
    ],
  },
};

// Ordered introduction sequence — kimchi is always first
export const NPC_ORDER = ['kimchi', 'kalbi', 'ellie', 'twins', 'maru', 'cinna', 'kola'];

export const CROP_EMOJI = { wheat:'🌾', corn:'🌽', pumpkin:'🎃', truffle:'🍄' };

// Cooldown windows
const NPC_COOLDOWN_MIN = 1 * 60 * 1000;
const NPC_COOLDOWN_MAX = 10 * 60 * 1000;
// After all NPCs are unlocked: randomise 1–15 min and hide the exact countdown
const NPC_COOLDOWN_UNLOCKED_MIN = 1 * 60 * 1000;
const NPC_COOLDOWN_UNLOCKED_MAX = 15 * 60 * 1000;

const REQ_CROP_MIN = 30, REQ_CROP_MAX = 80;
const REQ_COIN_MIN = 3000, REQ_COIN_MAX = 7000;

// ── HELPERS ───────────────────────────────────────────────

export function isTownUnlocked() {
  return state.rows >= 6 && state.cols >= 6 && state.barnLevel >= 3;
}

export function unlockedNpcIds() {
  return (state.unlockedNpcs || ['kimchi']).filter(id => NPC_DATA[id]);
}

/** Ensure every NPC entry exists in state.npcs (safe to call on every tick). */
export function migrateNpcs() {
  if (!state.npcs)         state.npcs         = {};
  if (!state.unlockedNpcs) state.unlockedNpcs = ['kimchi'];
  NPC_ORDER.forEach(id => {
    if (!state.npcs[id]) {
      state.npcs[id] = { affinity: 0, request: null, nextRequestAt: 0 };
    }
    if (state.npcs[id].nextRequestAt === undefined) state.npcs[id].nextRequestAt = 0;
    if (state.npcs[id].affinity      === undefined) state.npcs[id].affinity      = 0;
  });
}

export function generateRequest(npcId) {
  const npc = NPC_DATA[npcId];
  const template = npc.requests[randInt(0, npc.requests.length - 1)];
  const req = { type: template.type, cropKey: template.cropKey || null, coins: 0, crop: 0, text: '' };

  if (template.type === 'crop') {
    req.crop = randInt(REQ_CROP_MIN, REQ_CROP_MAX);
    req.text = template.text.replace('{qty}', req.crop);
  } else if (template.type === 'coin') {
    req.coins = randInt(REQ_COIN_MIN, REQ_COIN_MAX);
    req.text  = template.text.replace('{qty}', req.coins.toLocaleString());
  } else { // combo
    req.crop  = randInt(REQ_CROP_MIN, REQ_CROP_MAX);
    req.coins = randInt(REQ_COIN_MIN, REQ_COIN_MAX);
    req.text  = template.text
      .replace('{cropQty}', req.crop)
      .replace('{qty}',     req.crop)  // fallback placeholder
      .replace('{coinQty}', req.coins.toLocaleString());
  }
  return req;
}

function tryUnlockNextNpc() {
  const unlocked = state.unlockedNpcs || ['kimchi'];
  const next = NPC_ORDER.find(id => !unlocked.includes(id));
  if (!next) return;
  state.unlockedNpcs.push(next);
  state.npcs[next].nextRequestAt = 0; // immediate first request
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

/** Called every second by the tick loop. */
export function tickNpcs() {
  if (!isTownUnlocked()) return;
  migrateNpcs();
  let changed = false;
  unlockedNpcIds().forEach(id => {
    const npc = state.npcs[id];
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

export function deliverRequest(npcId) {
  const npc = state.npcs[npcId];
  if (!npc || !npc.request) return;
  const req = npc.request;

  // Validate
  if (req.crop > 0 && (state[req.cropKey] || 0) < req.crop) {
    toast(`Not enough ${CROP_EMOJI[req.cropKey]}!`);
    return;
  }
  if (req.coins > 0 && state.coins < req.coins) {
    toast('Not enough 🪙!');
    return;
  }

  // Deduct resources
  if (req.crop  > 0) state[req.cropKey] -= req.crop;
  if (req.coins > 0) state.coins        -= req.coins;

  // Reward affinity & schedule next request
  npc.affinity += 1;
  npc.request   = null;
  const allUnlocked = (state.unlockedNpcs || []).length >= NPC_ORDER.length;
  const cdMin = allUnlocked ? NPC_COOLDOWN_UNLOCKED_MIN : NPC_COOLDOWN_MIN;
  const cdMax = allUnlocked ? NPC_COOLDOWN_UNLOCKED_MAX : NPC_COOLDOWN_MAX;
  npc.nextRequestAt = Date.now() + randInt(cdMin, cdMax);

  tryUnlockNextNpc();

  saveState();
  // Trigger UI refreshes (imported lazily to avoid circular dep)
  import('./ui.js').then(({ updateHeader, updateShopUI, updateTownBadge: utb, renderTownTab: rtt }) => {
    updateHeader();
    updateShopUI();
    utb();
    rtt();
  });
  toast(`💛 Affinity with ${NPC_DATA[npcId].name} increased! (${npc.affinity})`);
}
