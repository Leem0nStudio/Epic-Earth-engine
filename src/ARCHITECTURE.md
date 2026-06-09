# Ragnarok Online MMORPG Core Architecture

Welcome to the data-driven decoupling system designed for the RO-inspired 2D/3D Hybrid MMORPG built with React, Next.js, Zustand, and React Three Fiber.

---

## 🏗️ Architectural Foundations

Our stack enforces two key principles:
1. **Total de-coupling of Systems**: All stats, movement, and logic live inside a centralized ecs engine (`src/core/ecs.ts`) and global Zustand state orchestrator (`src/core/store.ts`). R3F is strictly a visual output layer. Game mechanics are completely separated from rendering frame schedules.
2. **Data-Driven Rules**: Monsters, Jobs, Skills, and Items are never hardcoded inside files; they are read directly from their respective JSON catalogs inside `src/data/`.

---

## 📂 Subfolder Layout & Declarations

The codebase is organized in decoupled modules complying with standard MMORPG setups:

### 1. `src/core/` (Simulation Core)
* **`ecs.ts`**: High-performance Entity-Component-System framework where entities are unique IDs and logic layers run updates.
* **`store.ts`**: Shared global Zustand store hosting active entities, game logs, and event triggers.
* **`game-loop.ts`**: Tick logic clock based on `requestAnimationFrame` running separately from R3F animation rendering.

### 2. `src/world/` (Map Grid)
* **`types.ts`**: Ground tiles definitions (Blocked, Walkable, Water, SnipingBlocked).
* **`grid.ts`**: Pure A* Pathfinding logic & Direction solvers. Also produces procedurally generated field files.

### 3. `src/entities/` (MMORPG Prefabs)
* **`types.ts`**: Interface representations of Player, Monster, NPC, and Portal entities.

### 4. `src/combat/` (Battle Math and Matchups)
* **`types.ts`**: Modifiers dictionary including standard Size Penalty charts (Large vs. Dagger etc.) and Elemental damage matching grids.

### 5. `src/skills/` (Spell Casting Schemes)
* **`types.ts`**: casting, SP pools, categories and requirements parameters.

### 6. `src/items/` & `src/inventory/` & `src/equipment/`
* **`types.ts`**: Models item objects, inventory slots grids, item-equip allocations, and carrying weight limits (e.g. natural HP/SP healing stops if carrying >50% weight penalty).

### 7. `src/stats/` (Formulas Engine)
* **`formulas.ts`**: Dynamic calculation from primary stats (STR, AGI, VIT, INT, DEX, LUK) to secondary derived values (ASPD attack speed indices, accuracy Hit, evasion Flee, Hard/Soft DEF, variable cast times).

### 8. `src/network/` (Protocol Interface)
* **`types.ts`**: Mock Socket channels sending Old-School Ragnarok packet headers e.g. `CZ_REQUEST_MOVE`, `ZC_NOTIFY_DAMAGE`, decoupled from visual layers.

### 9. `src/ui/` (Hybrid Canvas Views)
* **`ThreeCanvas.tsx`**: R3F stage rendering cell maps, glowing portals, and character 2D Billboard Sprites moving in 3D fields.
* **`GameClient.tsx`**: Modern pixel-perfect Tailwind HUD overlay showing health indices, inventory, stats allocating buttons, and live protocol packet analyzers.

---

## 📊 Core Ragnarok Formula Schemas

### ⚔️ Attack Speed (ASPD) & Cooldown
$$\text{ASPD} = \text{BaseASPD} + \frac{(200 - \text{BaseASPD}) \times (\text{AGI} \times 4 + \text{DEX})}{1000}$$
$$\text{Attack Cooldown (ms)} = (200 - \text{ASPD}) \times 20$$

### 🧪 Carrying Weight Penalties
* **Weight $\ge$ 50%**: Disables natural HP & SP regeneration.
* **Weight $\ge$ 90%**: Disables standard movement, attacks, and skill cast actions.
