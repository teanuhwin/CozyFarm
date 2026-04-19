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
