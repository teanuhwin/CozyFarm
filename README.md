# 🌾 Cozy Farm

A cozy idle farming game that runs entirely in your browser — no server, no login, no install required. Plant crops, harvest them when they're ready, sell for coins, and grow your farm to unlock the bustling **Town Square**.

---

## 🎮 How to Play

1.  **Select a crop** from the toolbar at the top of the Farm tab.
2.  **Tap an empty plot** (🟫) to plant — costs 1 seed.
3.  **Wait** for the progress bar to fill — crops grow in real time, even when the tab is closed.
4.  **Tap a ready plot** (🌾 🌽 🎃 🍄) to harvest and add it to your barn.
5.  **Expand your farm** and upgrade your barn storage to meet the locals.

---

## 🏘️ Town Square (Phase 2)

The Town Square is the ultimate destination for master farmers. It remains hidden until your farm reaches its peak potential.

### **Unlock Requirements**
The Town tab appears automatically once you meet these two conditions:
* **6×6 Farm Grid:** Fully expanded plots.
* **Level 3 Barn:** Maxed storage capacity (100 slots).

### **The Residents**
Meet 7 unique NPCs, each with their own comical needs and request types:
* **Mayor Kimchi:** A literal dog who runs the town via an assistant.
* **Old Man Kalbi:** Grumpy but sweet; focuses on bulk wheat.
* **Lady Ellie:** High-society sophistication; demands high-tier truffles.
* **Mason & Jason:** Chaotic twins requesting items for their latest pranks.
* **Hunter Maru:** A cool cat with a sarcastic crow translator.
* **Herbalist Cinna:** Calm and medicinal; requests ingredients for her apothecary.
* **Wizard Kola:** Eccentric and cosmic; asks for resources to stabilize the moon.

---

## 🌾 Crops & 🧪 Supplies

### **Crops**
| Crop | Grow Time | Seed Cost | Sell Price | Unlocks At |
| :--- | :--- | :--- | :--- | :--- |
| 🌾 Wheat | 2 min | 🪙5 | 🪙10 | Start |
| 🌽 Corn | 8 min | 🪙15 | 🪙40 | 200🪙 Lifetime |
| 🎃 Pumpkin | 15 min | 🪙25 | 🪙80 | 500🪙 Lifetime |
| 🍄 Truffle | 45 min | 🪙50 | 🪙220 | 1500🪙 Lifetime |

### **Supplies**
| Item | Cost | Effect |
| :--- | :--- | :--- |
| 💧 Water | 🪙6 | 35% faster grow time |
| 🚿 Water Hose | 🪙200 | Waters all growing plots instantly |
| 🌿 Fertilizer | 🪙8 | +2 yield on harvest |
| 🧺 Big Fertilizer | 🪙280 | Fertilizes all growing plots instantly |
| 🧤 Gloves | 🪙80 | 60% chance to recover 1 seed (20 uses) |

---

## 🛠️ Technical Details & Local Development

This project has been refactored into a **modular ES6 structure** for efficiency and maintainability.

### **File Structure**
* `index.html`: The core UI skeleton.
* `style.css`: V2.2 responsive design with accessibility-boosted contrast.
* `js/main.js`: The game engine and tick loop.
* `js/state.js`: Global state management and `localStorage` persistence.
* `js/npcs.js`: Town Square logic, NPC data, and request generation.
* `js/ui.js`: Dynamic DOM rendering and plot updates.
* `js/bodie.js`: Helper Bodie logic. 

---

## 🚀 Roadmap
* 🏆 Additional achievements and milestones.
