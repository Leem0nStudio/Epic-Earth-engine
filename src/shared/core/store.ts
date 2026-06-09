import { create } from "zustand";
import { ECSWorld, Entity, EntityId } from "./ecs";
import { MapInstance } from "../world/types";
import { generateDevMap, findPath } from "../world/grid";
import { calculateDerivedStats, calculatePlayerRagnarokStats } from "../stats/formulas";
import { ItemDefinition } from "../items/types";
import { getAvailableSlotsForItemType, EquipmentSlotName } from "../equipment/types";
import { JobDefinition, getXpRequired } from "../jobs/types";
import { PlayerEntity, MonsterEntity, NpcEntity, PetEntity, SummonEntity, NpcInteraction } from "../entities/types";
import { EntityManager } from "../entities/EntityManager";
import { worldRuntime } from "../world/WorldLoader";
import { StorageBag, CartBag, GroundItem } from "../inventory/types";
import jobsData from "../data/jobs.json";
import monstersData from "../data/monsters.json";
import skillsData from "../data/skills.json";

const SKILLS_MAP = new Map(skillsData.skills.map((s: any) => [s.id, s]));
import itemsData from "../data/items.json";

export interface ActiveBuff {
  id: string;
  buffId: string;
  name: string;
  icon: string;
  remainingTimeMs: number;
  totalTimeMs: number;
  effects: {
    str?: number;
    agi?: number;
    vit?: number;
    int?: number;
    dex?: number;
    luk?: number;
    atk?: number;
    def?: number;
    mdef?: number;
    hit?: number;
    flee?: number;
    crit?: number;
    hpBonus?: number;
    spBonus?: number;
    aspdBonus?: number;
  };
}

export interface GameLog {
  id: string;
  timestamp: string;
  type: "system" | "battle" | "chat" | "info";
  message: string;
}

export interface GameState {
  // World entities and grid
  ecsWorld: ECSWorld;
  entityManager: EntityManager;
  currentMap: MapInstance;
  playerEntityId: EntityId;
  selectedEntityId: EntityId | null;
  
  // Game logs
  logs: GameLog[];
  
  // Buffs
  activeBuffs: ActiveBuff[];
  recalculatePlayerStats: () => void;
  
  // Interaction/UI states
  isInitializing: boolean;
  gameTickCount: number;
  
  // Data Catalogs (loaded from JSON)
  jobsCatalog: JobDefinition[];
  monstersCatalog: any[];
  skillsCatalog: any[];
  itemsCatalog: ItemDefinition[];

  // Store actions
  initializeGame: () => void;
  addLog: (message: string, type?: "system" | "battle" | "chat" | "info") => void;
  selectEntity: (id: EntityId | null) => void;
  
  // ECS Entity creation and triggers
  spawnPlayer: (name: string, jobId: string, x?: number, y?: number) => void;
  spawnMonster: (monsterId: string, x: number, y: number) => string;
  spawnNpc: (npcId: string, name: string, spriteSheetId: string, x: number, y: number, interactions?: NpcInteraction[]) => void;
  spawnPet: (name: string, petId: string, x: number, y: number) => void;
  spawnSummon: (name: string, summonId: string, x: number, y: number) => void;
  attackTarget: (targetId: EntityId) => void;
  awardXp: (amount: number) => void;
  bulkSpawnStressTest: (count: number) => void;
  movePlayerTo: (tx: number, ty: number) => void;
  
  // Map modification transitions
  setMap: (map: MapInstance) => void;
  loadMap: (mapId: string, spawnX?: number, spawnY?: number) => void;

  // Stats and Job allocation
  allocateStatPoint: (stat: "str" | "agi" | "vit" | "int" | "dex" | "luk") => void;
  changeJobClass: (newJobId: string) => void;
  levelUpBase: (levels?: number) => void;
  levelUpJob: (levels?: number) => void;
  resetStatsAndJob: () => void;
  
  // Equip / Inventory operations
  equipItem: (itemId: string) => void;
  unequipItem: (itemId: string) => void;
  consumeItem: (itemId: string) => void;

  // Separated Containers
  storage: StorageBag;
  cart: CartBag;
  groundItems: GroundItem[];

  // Inventory & Transfer Actions
  depositToStorage: (itemId: string, quantity: number) => void;
  withdrawFromStorage: (itemId: string, quantity: number) => void;
  depositToCart: (itemId: string, quantity: number) => void;
  withdrawFromCart: (itemId: string, quantity: number) => void;
  dropItem: (itemId: string, quantity: number) => void;
  pickUpGroundItem: (groundItemId: string) => void;
  rentCart: () => void;
  unrentCart: () => void;
  spawnRandomGroundItem: (itemId?: string, x?: number, y?: number) => void;
  
  // Game Engine update hook
  tick: (deltaTime: number) => void;
}

export const useGameStore = create<GameState>((set, get) => {
  // Initialize World
  const world = new ECSWorld();
  const em = new EntityManager();
  const emptyLoadingMap: MapInstance = {
    id: "loading",
    name: "Loading map layout...",
    width: 30,
    height: 30,
    cells: [],
    portals: [],
    npcs: [],
    monstersSpawnList: [],
    definition: {
      id: "loading",
      name: "Loading map layout...",
      scene: { bgm: "none", ambientColor: "#000000", lightIntensity: 1 },
      navigation: { width: 30, height: 30, grid: [] },
      spawns: { npcs: [], monsters: [] },
      portals: { portals: [] },
      regions: { regions: [] }
    },
  };

  return {
    ecsWorld: world,
    entityManager: em,
    currentMap: emptyLoadingMap,
    playerEntityId: "player_hero",
    selectedEntityId: null,
    logs: [],
    activeBuffs: [],
    isInitializing: true,
    gameTickCount: 0,

    // Separated containers state
    storage: { slots: [], maxSlots: 200 },
    cart: { slots: [], maxSlots: 50, hasCart: false, maxWeightLimit: 8000 },
    groundItems: [
      { id: "g_1", itemId: "jellopy", quantity: 5, x: 14, y: 14, droppedAt: Date.now() },
      { id: "g_2", itemId: "valiant_crest", quantity: 1, x: 16, y: 14, droppedAt: Date.now() },
      { id: "g_3", itemId: "red_potion", quantity: 2, x: 15, y: 17, droppedAt: Date.now() }
    ],
    
    // catalogs
    jobsCatalog: jobsData.jobs as unknown as JobDefinition[],
    monstersCatalog: monstersData.monsters,
    skillsCatalog: skillsData.skills,
    itemsCatalog: itemsData.items as unknown as ItemDefinition[],

    initializeGame: () => {
      const { addLog } = get();
      
      addLog("System: Initializing Ragnarok RO Editor-Exported World...", "system");
      
      // Load initial map using our decoupled WorldLoader runtime
      worldRuntime.loadMap("prontera_south", get(), 15, 12);

      set({ isInitializing: false });
      addLog("System: World loaded. Explore the layout using portals.", "system");
    },

    addLog: (message: string, type = "info") => {
      const d = new Date();
      const timeStr = d.toTimeString().split(" ")[0];
      const newLog: GameLog = {
        id: Math.random().toString(36).substring(7),
        timestamp: timeStr,
        type,
        message,
      };
      set((state) => ({
        logs: [newLog, ...state.logs].slice(0, 50), // keep latest 50 logs
      }));
    },

    selectEntity: (id) => {
      set({ selectedEntityId: id });
    },

    recalculatePlayerStats: () => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.stats || !player.components.job) return;

      const jobDataObj = player.components.job;
      const jobDesc = get().jobsCatalog.find((j) => j.id === jobDataObj.jobId) || get().jobsCatalog[0];

      // Safe initialization of base stats if undefined
      const statsComp = player.components.stats as any;
      if (statsComp.baseStr === undefined) statsComp.baseStr = statsComp.str || 9;
      if (statsComp.baseAgi === undefined) statsComp.baseAgi = statsComp.agi || 9;
      if (statsComp.baseVit === undefined) statsComp.baseVit = statsComp.vit || 9;
      if (statsComp.baseInt === undefined) statsComp.baseInt = statsComp.int || 9;
      if (statsComp.baseDex === undefined) statsComp.baseDex = statsComp.dex || 9;
      if (statsComp.baseLuk === undefined) statsComp.baseLuk = statsComp.luk || 9;

      // 1. Calculate Equipment Stats
      const equipStats = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0, atk: 0, def: 0, mdef: 0, hpBonus: 0, spBonus: 0 };
      const eq = player.components.equipment || {};
      Object.keys(eq).forEach((slotKey) => {
        const itemId = (eq as any)[slotKey];
        if (itemId) {
          const item = get().itemsCatalog.find((i) => i.id === itemId);
          if (item && item.effects) {
            const eff = item.effects;
            if (eff.str) equipStats.str += eff.str;
            if (eff.agi) equipStats.agi += eff.agi;
            if (eff.vit) equipStats.vit += eff.vit;
            if (eff.int) equipStats.int += eff.int;
            if (eff.dex) equipStats.dex += eff.dex;
            if (eff.luk) equipStats.luk += eff.luk;
            if (eff.atk) equipStats.atk += eff.atk;
            if (eff.def) equipStats.def += eff.def;
            if (eff.mdef) equipStats.mdef += eff.mdef;
          }
        }
      });

      // Default bare-fisted weapon ATK
      if (!eq.weapon) {
        equipStats.atk = 10;
      }

      // 2. Calculate Buff Stats
      const buffStats = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0, atk: 0, def: 0, mdef: 0, hit: 0, flee: 0, crit: 0, hpBonus: 0, spBonus: 0, aspdBonus: 0 };
      const activeBuffs = get().activeBuffs || [];
      activeBuffs.forEach((b) => {
        if (b.effects) {
          const eff = b.effects;
          if (eff.str) buffStats.str += eff.str;
          if (eff.agi) buffStats.agi += eff.agi;
          if (eff.vit) buffStats.vit += eff.vit;
          if (eff.int) buffStats.int += eff.int;
          if (eff.dex) buffStats.dex += eff.dex;
          if (eff.luk) buffStats.luk += eff.luk;
          if (eff.atk) buffStats.atk += eff.atk;
          if (eff.def) buffStats.def += eff.def;
          if (eff.mdef) buffStats.mdef += eff.mdef;
          if (eff.hit) buffStats.hit += eff.hit;
          if (eff.flee) buffStats.flee += eff.flee;
          if (eff.crit) buffStats.crit += eff.crit;
          if (eff.hpBonus) buffStats.hpBonus += eff.hpBonus;
          if (eff.spBonus) buffStats.spBonus += eff.spBonus;
          if (eff.aspdBonus) buffStats.aspdBonus += eff.aspdBonus;
        }
      });

      const basePrimary = {
        str: statsComp.baseStr,
        agi: statsComp.baseAgi,
        vit: statsComp.baseVit,
        int: statsComp.baseInt,
        dex: statsComp.baseDex,
        luk: statsComp.baseLuk,
      };

      const result = calculatePlayerRagnarokStats(
        basePrimary,
        equipStats,
        buffStats,
        jobDataObj.baseLevel,
        jobDesc.baseStatsIncrements.hpFactor,
        jobDesc.baseStatsIncrements.spFactor
      );

      // Preserve ratios
      const hpRatio = statsComp.maxHp > 0 ? (statsComp.currentHp / statsComp.maxHp) : 1;
      const spRatio = statsComp.maxSp > 0 ? (statsComp.currentSp / statsComp.maxSp) : 1;

      // Assign derived values
      Object.assign(statsComp, result.derived);

      // Save Final totals as primary properties so general components remain un-broken
      statsComp.str = result.finalPrimary.str;
      statsComp.agi = result.finalPrimary.agi;
      statsComp.vit = result.finalPrimary.vit;
      statsComp.int = result.finalPrimary.int;
      statsComp.dex = result.finalPrimary.dex;
      statsComp.luk = result.finalPrimary.luk;

      // Ensure raw base is preserved
      statsComp.baseStr = basePrimary.str;
      statsComp.baseAgi = basePrimary.agi;
      statsComp.baseVit = basePrimary.vit;
      statsComp.baseInt = basePrimary.int;
      statsComp.baseDex = basePrimary.dex;
      statsComp.baseLuk = basePrimary.luk;

      // Attach Breakdown components
      statsComp.breakdown = result.breakdown;

      statsComp.maxHp = result.derived.maxHp;
      statsComp.maxSp = result.derived.maxSp;
      statsComp.currentHp = Math.min(statsComp.maxHp, Math.max(1, Math.round(result.derived.maxHp * hpRatio)));
      statsComp.currentSp = Math.min(statsComp.maxSp, Math.max(0, Math.round(result.derived.maxSp * spRatio)));

      if (player.components.stats) {
        player.components.stats = statsComp;
      }
    },

    spawnPlayer: (name, jobId, x, y) => {
      const ecs = get().ecsWorld;
      const em = get().entityManager;
      const jobDesc = get().jobsCatalog.find((j) => j.id === jobId) || get().jobsCatalog[0];

      // Default inventory with classic consumable buffs and equipments
      const initialInventory = [
        { slotId: 0, itemId: "red_potion", quantity: 15 },
        { slotId: 1, itemId: "blue_potion", quantity: 10 },
        { slotId: 2, itemId: "blessing_scroll", quantity: 5 },
        { slotId: 3, itemId: "increase_agi_scroll", quantity: 5 },
        { slotId: 4, itemId: "berserk_potion", quantity: 5 },
        { slotId: 5, itemId: "grilled_griffin_food", quantity: 3 },
        { slotId: 6, itemId: "honey_herbal_tea", quantity: 3 },
        { slotId: 7, itemId: "knife", quantity: 1 },
        { slotId: 8, itemId: "composite_bow", quantity: 1 },
        { slotId: 9, itemId: "apple_o_archer", quantity: 1 },
        { slotId: 10, itemId: "iron_shield", quantity: 1 },
      ];

      const baseStats = { str: 9, agi: 9, vit: 9, int: 9, dex: 9, luk: 9 };
      const px = x !== undefined ? x : 15;
      const py = y !== undefined ? y : 15;
      const playerPos = { x: px, y: py, z: 0, speed: 4.5, direction: 4 };

      // Initialize the stats container with raw and baseline fields
      const playerStats: any = {
        baseStr: 9,
        baseAgi: 9,
        baseVit: 9,
        baseInt: 9,
        baseDex: 9,
        baseLuk: 9,
        str: 9,
        agi: 9,
        vit: 9,
        int: 9,
        dex: 9,
        luk: 9,
        currentHp: 100,
        currentSp: 10,
        baseHp: 100,
        baseSp: 10,
        maxHp: 100,
        maxSp: 10,
      };

      const player = new PlayerEntity("player_hero", name, jobId, playerPos, playerStats, "idle");
      player.components.inventory = {
        slots: initialInventory,
        maxSlots: 100,
      };
      player.components.combat = {
        isCasting: false,
        castProgress: 0,
        totalCastTime: 0,
        lastAttackTime: 0,
        attackCooldown: 1000,
        activeSkill: undefined,
        skills: [],
      };

      ecs.registerExistingEntity(player);
      em.spawn(player);

      get().addLog(`System: Player ${name} spawned as job ${jobDesc.name}.`, "system");
      
      // Centralized stats and breakdown recalculation
      get().recalculatePlayerStats();
      
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    spawnMonster: (monsterId, x, y) => {
      const ecs = get().ecsWorld;
      const em = get().entityManager;
      const entityId = `monster_${monsterId}_${Math.random().toString(36).substring(4)}`;
      const monDesc = get().monstersCatalog.find((m) => m.id === monsterId);
      
      if (!monDesc) {
        // Fallback dummy monster stats if missing
        const dummyPos = { x, y, z: 0, speed: 1.2, direction: Math.floor(Math.random() * 8) };
        const dummyStats = { currentHp: 100, maxHp: 100, currentSp: 10, maxSp: 10, str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 };
        const dummyMonster = new MonsterEntity(
          entityId,
          monsterId,
          monsterId,
          1,
          [],
          "passive",
          50,
          dummyPos,
          dummyStats,
          "idle"
        );
        ecs.registerExistingEntity(dummyMonster);
        em.spawn(dummyMonster);
        set({ gameTickCount: get().gameTickCount + 1 });
        return entityId;
      }

      // Derive secondary stats
      const derived = calculateDerivedStats(
        monDesc.stats,
        monDesc.level,
        8, // general HP factor
        3, // SP factor
        30, // base weapon
        15, // base armor
        15  // magic defense
      );

      const monPos = { x, y, z: 0, speed: monDesc.moveSpeed, direction: Math.floor(Math.random() * 8) };
      const monStats = {
        baseHp: monDesc.hp,
        baseSp: monDesc.sp,
        currentHp: monDesc.hp,
        currentSp: monDesc.sp,
        ...monDesc.stats,
        ...derived,
      };

      const monster = new MonsterEntity(
        entityId,
        monDesc.name,
        monsterId,
        monDesc.level,
        monDesc.drops || [],
        monDesc.aiType || "passive",
        monDesc.baseXp || 0,
        monPos,
        monStats,
        "idle"
      );

      monster.components.combat = {
        isCasting: false,
        castProgress: 0,
        totalCastTime: 0,
        lastAttackTime: 0,
        attackCooldown: 1000,
        activeSkill: undefined,
        skills: [],
      };

      ecs.registerExistingEntity(monster);
      em.spawn(monster);
      set({ gameTickCount: get().gameTickCount + 1 });
      return entityId;
    },

    spawnNpc: (npcId, name, spriteSheetId, x, y, interactions = []) => {
      const ecs = get().ecsWorld;
      const em = get().entityManager;
      const pos = { x, y, z: 0, speed: 0, direction: 4 };
      const stats = { currentHp: 500, maxHp: 500, currentSp: 100, maxSp: 100, str: 10, agi: 10, vit: 10, int: 10, dex: 10, luk: 10 };
      
      const npc = new NpcEntity(npcId, name, spriteSheetId, interactions, pos, stats, "idle");
      
      ecs.registerExistingEntity(npc);
      em.spawn(npc);

      get().addLog(`System: NPC ${name} spawned at coordinate (${x}, ${y}).`, "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    setMap: (map) => {
      set({ currentMap: map });
    },

    loadMap: (mapId, spawnX, spawnY) => {
      worldRuntime.loadMap(mapId, get(), spawnX, spawnY);
    },

    spawnPet: (name, petId, x, y) => {
      const ecs = get().ecsWorld;
      const em = get().entityManager;
      const pos = { x, y, z: 0, speed: 5.0, direction: 4 };
      const stats = { currentHp: 200, maxHp: 200, currentSp: 100, maxSp: 100, str: 6, agi: 18, vit: 12, int: 8, dex: 15, luk: 25 };
      
      const pet = new PetEntity(`pet_${petId}_${Math.random().toString(36).substring(4)}`, name, "player_hero", pos, stats, "following");
      
      ecs.registerExistingEntity(pet);
      em.spawn(pet);

      get().addLog(`System: Cute companion pet ${name} spawned at (${x}, ${y})!`, "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    spawnSummon: (name, summonId, x, y) => {
      const ecs = get().ecsWorld;
      const em = get().entityManager;
      const pos = { x, y, z: 0, speed: 5.5, direction: 4 };
      const stats = { currentHp: 600, maxHp: 600, currentSp: 400, maxSp: 400, str: 15, agi: 14, vit: 16, int: 30, dex: 18, luk: 10 };
      
      const summon = new SummonEntity(`summon_${summonId}_${Math.random().toString(36).substring(4)}`, name, "player_hero", pos, stats, 60, "idle");
      
      ecs.registerExistingEntity(summon);
      em.spawn(summon);

      get().addLog(`System: Guardian Spirit ${name} summoned onto coordinates (${x}, ${y})!`, "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    attackTarget: (targetId) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      const target = ecs.getEntity(targetId);
      if (!player || !target || !player.components.combat) return;

      player.components.combat.targetEntityId = targetId;
      get().addLog(`Combat: Initiating attack on ${target.components.identity?.name || "target"}.`, "battle");
    },
    awardXp: (amount) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.job) return;
        
      player.components.job.baseXp += amount;
      get().addLog(`Combat: Gained ${amount} Base XP.`, "battle");
        
      // Check for level up
      const nextXp = getXpRequired(player.components.job.baseLevel, "base");
      if (player.components.job.baseXp >= nextXp) {
          player.components.job.baseLevel += 1;
          player.components.job.baseXp -= nextXp;
          get().addLog(`Level Up: You are now level ${player.components.job.baseLevel}!`, "system");
      }
    },
    bulkSpawnStressTest: (count) => {
      const ecs = get().ecsWorld;
      const em = get().entityManager;
      const map = get().currentMap;
      
      const tStart = performance.now();
      
      let spawnedCount = 0;
      const typesList: ("monster" | "npc" | "pet" | "summon")[] = ["monster", "pet", "summon", "npc"];
      const names = ["Ragnarok Ghost", "Chibi Deviruchi", "Angeling Sprite", "Smokie Companion", "Savage Bebe", "Poporing Pet", "Wandering Novice"];
      
      for (let i = 0; i < count; i++) {
        // Find random cell
        const rx = Math.floor(Math.random() * (map.width - 2)) + 1;
        const ry = Math.floor(Math.random() * (map.height - 2)) + 1;
        
        // Random choose type
        const typeChoice = typesList[Math.floor(Math.random() * typesList.length)];
        const randName = `${names[Math.floor(Math.random() * names.length)]} #${i}`;
        const id = `bulk_${typeChoice}_${i}_${Math.random().toString(36).substring(4)}`;
        
        const pos = { x: rx, y: ry, z: 0, speed: 2 + Math.random() * 4, direction: Math.floor(Math.random() * 8) };
        const stats = { currentHp: 100, maxHp: 100, currentSp: 50, maxSp: 50, str: 10, agi: 10, vit: 10, int: 10, dex: 10, luk: 10 };
        
        let entity;
        if (typeChoice === "monster") {
          entity = new MonsterEntity(id, randName, "poring", 1, [], "passive", 50, pos, stats);
        } else if (typeChoice === "npc") {
          entity = new NpcEntity(id, randName, "npc_kafra", [{ type: "dialogue", data: { text: "Talk" } }], pos, stats);
        } else if (typeChoice === "pet") {
          entity = new PetEntity(id, randName, "player_hero", pos, stats);
        } else {
          entity = new SummonEntity(id, randName, "player_hero", pos, stats);
        }
        
        ecs.registerExistingEntity(entity);
        em.spawn(entity);
        spawnedCount++;
      }
      
      const tEnd = performance.now();
      const elapsed = (tEnd - tStart).toFixed(2);
      
      get().addLog(`System: Mass-spawned ${spawnedCount} unique entities into world. Indexing elapsed: ${elapsed}ms.`, "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    movePlayerTo: (tx, ty) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.position) return;

      const sx = Math.round(player.components.position.x);
      const sy = Math.round(player.components.position.y);
      const path = findPath(get().currentMap, sx, sy, tx, ty);
      
      if (!path || path.length < 2) return;

      // Skip the first node as it's the current position
      player.components.position.path = path.slice(1);
      
      // Set initial target
      const next = player.components.position.path[0];
      player.components.position.targetX = next[0];
      player.components.position.targetY = next[1];
      player.components.render!.currentAnimation = "walk";

      get().addLog(`System: Navigating hero to coordinate (${tx}, ${ty}).`, "info");
    },

    allocateStatPoint: (stat) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.stats || !player.components.job) return;

      const statsComp = player.components.stats as any;
      const baseKey = `base${stat.charAt(0).toUpperCase()}${stat.slice(1)}`;
      
      // Safe initialization of base stats if undefined
      if (statsComp[baseKey] === undefined) {
        statsComp[baseKey] = statsComp[stat] || 9;
      }

      // Increment raw base stat!
      statsComp[baseKey] += 1;

      // Centralized properties refresh
      get().recalculatePlayerStats();

      get().addLog(`System: Point allocated to ${stat.toUpperCase()}. Stats updated.`, "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    changeJobClass: (newJobId) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.job || !player.components.stats) return;

      const nextJob = get().jobsCatalog.find((j) => j.id === newJobId);
      if (!nextJob) return;

      player.components.job.jobId = newJobId;
      player.components.job.jobLevel = 1;
      player.components.render!.spriteSheetId = `char_${newJobId}`;

      // Recalculate stats using centralized engine
      get().recalculatePlayerStats();

      get().addLog(`System: Job class advanced to ${nextJob.name}!`, "chat");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    levelUpBase: (levels = 1) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.job) return;

      const curLvl = player.components.job.baseLevel || 1;
      const nextLvl = Math.min(150, curLvl + levels);
      player.components.job.baseLevel = nextLvl;
      player.components.job.skillPoints = (player.components.job.skillPoints || 0) + (levels * 5);

      get().recalculatePlayerStats();
      get().addLog(`System: Base Level Up (+${levels})! You are now Base Lv ${nextLvl}!`, "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    levelUpJob: (levels = 1) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.job) return;

      const jobDataObj = player.components.job;
      const jobDesc = get().jobsCatalog.find((j) => j.id === jobDataObj.jobId) || get().jobsCatalog[0];

      const prevLvl = jobDataObj.jobLevel || 1;
      const nextLvl = Math.min(jobDesc.maxJobLevel, prevLvl + levels);
      jobDataObj.jobLevel = nextLvl;
      jobDataObj.skillPoints = (jobDataObj.skillPoints || 0) + (nextLvl - prevLvl);

      get().addLog(`System: Job Level Up (+${levels})! You are now Job Lv ${nextLvl}!`, "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    resetStatsAndJob: () => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.job || !player.components.stats) return;

      player.components.job.jobId = "novice";
      player.components.job.baseLevel = 1;
      player.components.job.jobLevel = 1;
      player.components.job.skillPoints = 5;

      if (player.components.render) {
        player.components.render.spriteSheetId = "char_novice";
      }

      const statsComp = player.components.stats as any;
      statsComp.baseStr = 9;
      statsComp.baseAgi = 9;
      statsComp.baseVit = 9;
      statsComp.baseInt = 9;
      statsComp.baseDex = 9;
      statsComp.baseLuk = 9;

      if (player.components.equipment) {
        player.components.equipment.weapon = undefined;
        player.components.equipment.shield = undefined;
        player.components.equipment.headgearUpper = undefined;
      }

      if (player.components.inventory) {
        player.components.inventory.slots.forEach((s: any) => {
          s.isEquipped = false;
        });
      }

      get().recalculatePlayerStats();
      get().addLog("System: RESET successful. Restored Base Lv 1 Novice with baseline stats.", "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    equipItem: (itemId) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.inventory || !player.components.equipment || !player.components.job) return;

      const item = get().itemsCatalog.find((i) => i.id === itemId);
      if (!item) return;

      const jobDataObj = player.components.job;
      const jobDesc = get().jobsCatalog.find((j) => j.id === jobDataObj.jobId) || get().jobsCatalog[0];

      // Enforce job-based weapon restrictions
      if (item.type === "weapon") {
        const wType = item.weaponType || "unarmed";
        const allowed = jobDesc.allowedWeapons || [];
        if (!allowed.includes(wType)) {
          get().addLog(`System: Weapon Type [${wType.toUpperCase()}] is not allowed for job class ${jobDesc.name}. Required: ${allowed.join(", ")}`, "chat");
          return;
        }
      }

      const inv = player.components.inventory;
      const eq = player.components.equipment as any;

      // Find item slot
      const tSlot = inv.slots.find((s) => s.itemId === itemId && !s.isEquipped);
      if (!tSlot) return;

      // Determine available slots
      const availableSlots = getAvailableSlotsForItemType(item.type);
      if (availableSlots.length === 0) {
        get().addLog(`System: Item type ${item.type} cannot be equipped.`, "info");
        return;
      }
      
      // Select the first available slot by default, or fill accessoryRight if left is taken
      let targetSlot = availableSlots[0] as EquipmentSlotName;
      if (item.type === "accessory" && eq.accessoryLeft && !eq.accessoryRight) {
        targetSlot = "accessoryRight";
      }

      // Handle old item in slot
      const oldItemIdInSlot = eq[targetSlot];
      if (oldItemIdInSlot) {
        const oldItemSlot = inv.slots.find((s) => s.itemId === oldItemIdInSlot && s.isEquipped);
        if (oldItemSlot) oldItemSlot.isEquipped = false;
      }
      
      // Auto-unequip 2H weapon <-> Shield conflict
      if (item.type === "weapon") {
           const isTwoHanded = item.weaponType === "bow" || item.weaponType === "two_handed_sword" || item.weaponType === "katars";
           if (isTwoHanded && eq.shield) {
               const oldS = inv.slots.find((s) => s.itemId === eq.shield && s.isEquipped);
               if (oldS) oldS.isEquipped = false;
               eq.shield = undefined;
           }
      }
      if (item.type === "shield" && eq.weapon) {
           const w = get().itemsCatalog.find(i=>i.id === eq.weapon);
           const isTwoHanded = w && (w.weaponType === "bow" || w.weaponType === "two_handed_sword" || w.weaponType === "katars");
           if (isTwoHanded) {
               const oldW = inv.slots.find((s) => s.itemId === eq.weapon && s.isEquipped);
               if (oldW) oldW.isEquipped = false;
               eq.weapon = undefined;
           }
      }

      // Equip
      eq[targetSlot] = itemId;
      tSlot.isEquipped = true;
      get().addLog(`System: Equipped ${item.name} to ${targetSlot}.`, "info");

      // Recalculate stats using centralized engine
      get().recalculatePlayerStats();
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    unequipItem: (itemId) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.inventory || !player.components.equipment) return;

      const item = get().itemsCatalog.find((i) => i.id === itemId);
      if (!item) return;

      const inv = player.components.inventory;
      const eq = player.components.equipment as any;

      const tSlot = inv.slots.find((s) => s.itemId === itemId && s.isEquipped);
      if (!tSlot) return;

      tSlot.isEquipped = false;
      
      // Find and clear the slot
      for(const key of Object.keys(eq)) {
          if (eq[key] === itemId) {
              eq[key] = undefined;
          }
      }

      get().addLog(`System: Unequipped ${item.name}.`, "info");

      // Recalculate stats using centralized engine
      get().recalculatePlayerStats();
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    consumeItem: (itemId) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.inventory || !player.components.stats) return;

      const item = get().itemsCatalog.find((i) => i.id === itemId);
      if (!item || item.type !== "usable") return;

      const inv = player.components.inventory;
      const slot = inv.slots.find((s) => s.itemId === itemId && s.quantity > 0);
      if (!slot) return;

      // Consume
      slot.quantity -= 1;
      if (slot.quantity <= 0) {
        inv.slots = inv.slots.filter((s) => s !== slot);
      }

      let consumedMessage = `Item: Consumed ${item.name}.`;
      let didAnything = false;

      // Apply HP restoration if present
      if (item.effects?.healHp) {
        const recovery = item.effects.healHp;
        const stats = player.components.stats;
        const prevHp = stats.currentHp;
        stats.currentHp = Math.min(stats.maxHp, stats.currentHp + recovery);
        consumedMessage += ` Healed +${stats.currentHp - prevHp} HP.`;
        didAnything = true;
      }

      // Apply SP restoration if present
      if (item.effects?.healSp) {
        const recovery = item.effects.healSp;
        const stats = player.components.stats;
        const prevSp = stats.currentSp;
        stats.currentSp = Math.min(stats.maxSp, stats.currentSp + recovery);
        consumedMessage += ` Restored +${stats.currentSp - prevSp} SP.`;
        didAnything = true;
      }

      // Apply dynamic data-driven buff triggers!
      if (item.effects?.buffId) {
        const buffId = item.effects.buffId;
        const bName = item.effects.buffName || item.name;
        const bIcon = item.effects.buffIcon || "🧪";
        const bDuration = item.effects.buffDurationMs || 60000;
        const bEff = item.effects.buffEffects || {};

        const activeBuffs = [...(get().activeBuffs || [])];
        const filtered = activeBuffs.filter((bf) => bf.buffId !== buffId);

        filtered.push({
          id: `${buffId}_${Date.now()}`,
          buffId,
          name: bName,
          icon: bIcon,
          remainingTimeMs: bDuration,
          totalTimeMs: bDuration,
          effects: bEff,
        });

        set({ activeBuffs: filtered });
        consumedMessage += ` Acquired active effect: [${bIcon} ${bName}]!`;
        didAnything = true;
      }

      if (didAnything) {
        get().addLog(consumedMessage, "battle");
        get().recalculatePlayerStats();
      } else {
        get().addLog(`Item: Consumed ${item.name} with no direct effects.`, "info");
      }

      set({ gameTickCount: get().gameTickCount + 1 });
    },

    depositToStorage: (itemId, quantity) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.inventory) return;

      const item = get().itemsCatalog.find((i) => i.id === itemId);
      if (!item) return;

      const inv = player.components.inventory;
      const slot = inv.slots.find((s) => s.itemId === itemId && !s.isEquipped && s.quantity >= quantity);
      if (!slot) {
        get().addLog(`Kafra Storage: You do not have enough unequipped ${item.name} to deposit.`, "info");
        return;
      }

      // 1. Subtract from inventory
      slot.quantity -= quantity;
      if (slot.quantity <= 0) {
        inv.slots = inv.slots.filter((s) => s !== slot);
      }

      // 2. Add to Storage
      const storage = { ...get().storage };
      const isStackable = item.type === "usable" || item.type === "etc" || item.type === "quest" || item.type === "card";

      if (isStackable) {
        const existing = storage.slots.find((s) => s.itemId === itemId);
        if (existing) {
          existing.quantity += quantity;
        } else {
          storage.slots.push({ itemId, quantity });
        }
      } else {
        for (let i = 0; i < quantity; i++) {
          storage.slots.push({ itemId, quantity: 1 });
        }
      }

      set({ storage });
      get().addLog(`Kafra Storage: Deposited ${quantity}x ${item.name} successfully.`, "info");
      get().recalculatePlayerStats();
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    withdrawFromStorage: (itemId, quantity) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.inventory) return;

      const item = get().itemsCatalog.find((i) => i.id === itemId);
      if (!item) return;

      const storage = { ...get().storage };
      const slotsWithItem = storage.slots.filter((s) => s.itemId === itemId);
      const totalAvailable = slotsWithItem.reduce((sum, s) => sum + s.quantity, 0);

      if (totalAvailable < quantity) {
        get().addLog(`Kafra Storage: Not enough ${item.name} in storage.`, "info");
        return;
      }

      // 1. Subtract from Storage
      let remainingToSubtract = quantity;
      for (let i = storage.slots.length - 1; i >= 0; i--) {
        const slot = storage.slots[i];
        if (slot.itemId === itemId) {
          if (slot.quantity >= remainingToSubtract) {
            slot.quantity -= remainingToSubtract;
            remainingToSubtract = 0;
            break;
          } else {
            remainingToSubtract -= slot.quantity;
            slot.quantity = 0;
          }
        }
      }
      storage.slots = storage.slots.filter((s) => s.quantity > 0);

      // 2. Add to inventory
      const inv = player.components.inventory;
      const isStackable = item.type === "usable" || item.type === "etc" || item.type === "quest" || item.type === "card";

      if (isStackable) {
        const existing = inv.slots.find((s) => s.itemId === itemId && !s.isEquipped);
        if (existing) {
          existing.quantity += quantity;
        } else {
          const maxSlotId = inv.slots.reduce((max, s) => Math.max(max, s.slotId), -1);
          inv.slots.push({ slotId: maxSlotId + 1, itemId, quantity });
        }
      } else {
        for (let i = 0; i < quantity; i++) {
          const maxSlotId = inv.slots.reduce((max, s) => Math.max(max, s.slotId), -1);
          inv.slots.push({ slotId: maxSlotId + 1, itemId, quantity: 1 });
        }
      }

      set({ storage });
      get().addLog(`Kafra Storage: Withdrew ${quantity}x ${item.name} to inventory.`, "info");
      get().recalculatePlayerStats();
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    depositToCart: (itemId, quantity) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.inventory) return;

      const cart = { ...get().cart };
      if (!cart.hasCart) {
        get().addLog("System: You do not have a Cart! Rent one first at the Kafra Specialist.", "chat");
        return;
      }

      const item = get().itemsCatalog.find((i) => i.id === itemId);
      if (!item) return;

      const inv = player.components.inventory;
      const slot = inv.slots.find((s) => s.itemId === itemId && !s.isEquipped && s.quantity >= quantity);
      if (!slot) {
        get().addLog(`Cart: You don't have enough unequipped ${item.name} to deposit.`, "info");
        return;
      }

      // 1. Subtract from inventory
      slot.quantity -= quantity;
      if (slot.quantity <= 0) {
        inv.slots = inv.slots.filter((s) => s !== slot);
      }

      // 2. Add to Cart
      const isStackable = item.type === "usable" || item.type === "etc" || item.type === "quest" || item.type === "card";

      if (isStackable) {
        const existing = cart.slots.find((s) => s.itemId === itemId);
        if (existing) {
          existing.quantity += quantity;
        } else {
          cart.slots.push({ itemId, quantity });
        }
      } else {
        for (let i = 0; i < quantity; i++) {
          cart.slots.push({ itemId, quantity: 1 });
        }
      }

      set({ cart });
      get().addLog(`Cart: Loaded ${quantity}x ${item.name} into Cart.`, "info");
      get().recalculatePlayerStats();
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    withdrawFromCart: (itemId, quantity) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.inventory) return;

      const item = get().itemsCatalog.find((i) => i.id === itemId);
      if (!item) return;

      const cart = { ...get().cart };
      if (!cart.hasCart) {
        get().addLog("System: You do not have active Cart.", "info");
        return;
      }

      const slotsWithItem = cart.slots.filter((s) => s.itemId === itemId);
      const totalAvailable = slotsWithItem.reduce((sum, s) => sum + s.quantity, 0);

      if (totalAvailable < quantity) {
        get().addLog(`Cart: Not enough ${item.name} in Cart storage.`, "info");
        return;
      }

      // 1. Subtract from Cart
      let remainingToSubtract = quantity;
      for (let i = cart.slots.length - 1; i >= 0; i--) {
        const slot = cart.slots[i];
        if (slot.itemId === itemId) {
          if (slot.quantity >= remainingToSubtract) {
            slot.quantity -= remainingToSubtract;
            remainingToSubtract = 0;
            break;
          } else {
            remainingToSubtract -= slot.quantity;
            slot.quantity = 0;
          }
        }
      }
      cart.slots = cart.slots.filter((s) => s.quantity > 0);

      // 2. Add to inventory
      const inv = player.components.inventory;
      const isStackable = item.type === "usable" || item.type === "etc" || item.type === "quest" || item.type === "card";

      if (isStackable) {
        const existing = inv.slots.find((s) => s.itemId === itemId && !s.isEquipped);
        if (existing) {
          existing.quantity += quantity;
        } else {
          const maxSlotId = inv.slots.reduce((max, s) => Math.max(max, s.slotId), -1);
          inv.slots.push({ slotId: maxSlotId + 1, itemId, quantity });
        }
      } else {
        for (let i = 0; i < quantity; i++) {
          const maxSlotId = inv.slots.reduce((max, s) => Math.max(max, s.slotId), -1);
          inv.slots.push({ slotId: maxSlotId + 1, itemId, quantity: 1 });
        }
      }

      set({ cart });
      get().addLog(`Cart: Unloaded ${quantity}x ${item.name} to player inventory.`, "info");
      get().recalculatePlayerStats();
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    dropItem: (itemId, quantity) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.inventory) return;

      const item = get().itemsCatalog.find((i) => i.id === itemId);
      if (!item) return;

      const inv = player.components.inventory;
      const slot = inv.slots.find((s) => s.itemId === itemId && !s.isEquipped && s.quantity >= quantity);
      if (!slot) {
        get().addLog(`System: Not enough unequipped ${item.name} to drop.`, "info");
        return;
      }

      // 1. Subtract from inventory
      slot.quantity -= quantity;
      if (slot.quantity <= 0) {
        inv.slots = inv.slots.filter((s) => s !== slot);
      }

      // 2. Spawn GroundItem at player's position
      const px = Math.round(player.components.position?.x ?? 20);
      const py = Math.round(player.components.position?.y ?? 20);
      
      const newGroundItem: GroundItem = {
        id: `g_${Math.random().toString(36).substring(4)}`,
        itemId,
        quantity,
        x: px,
        y: py,
        droppedAt: Date.now()
      };

      set({ groundItems: [...get().groundItems, newGroundItem] });
      get().addLog(`System: You dropped ${quantity}x ${item.name} on the ground floor.`, "info");
      get().recalculatePlayerStats();
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    pickUpGroundItem: (groundItemId) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      if (!player || !player.components.inventory) return;

      const targetItem = get().groundItems.find((g) => g.id === groundItemId);
      if (!targetItem) {
        get().addLog("System: Ground item no longer exists.", "info");
        return;
      }

      const item = get().itemsCatalog.find((i) => i.id === targetItem.itemId);
      if (!item) return;

      const inv = player.components.inventory;
      const isStackable = item.type === "usable" || item.type === "etc" || item.type === "quest" || item.type === "card";

      if (isStackable) {
        const existing = inv.slots.find((s) => s.itemId === targetItem.itemId && !s.isEquipped);
        if (existing) {
          existing.quantity += targetItem.quantity;
        } else {
          const maxSlotId = inv.slots.reduce((max, s) => Math.max(max, s.slotId), -1);
          inv.slots.push({ slotId: maxSlotId + 1, itemId: targetItem.itemId, quantity: targetItem.quantity });
        }
      } else {
        for (let i = 0; i < targetItem.quantity; i++) {
          const maxSlotId = inv.slots.reduce((max, s) => Math.max(max, s.slotId), -1);
          inv.slots.push({ slotId: maxSlotId + 1, itemId: targetItem.itemId, quantity: 1 });
        }
      }

      set({ groundItems: get().groundItems.filter((g) => g.id !== groundItemId) });
      get().addLog(`System: Picked up ${targetItem.quantity}x ${item.name} from the ground.`, "info");
      get().recalculatePlayerStats();
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    rentCart: () => {
      const cart = { ...get().cart };
      if (cart.hasCart) {
        get().addLog("System: You already have a rented Cart loaded.", "info");
        return;
      }
      cart.hasCart = true;
      set({ cart });
      get().addLog("Kafra: Cart rented successfully! Heavy weight capacity increased.", "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    unrentCart: () => {
      const cart = { ...get().cart };
      if (!cart.hasCart) {
        get().addLog("System: You do not have a Cart currently rented.", "info");
        return;
      }
      cart.hasCart = false;
      
      // Safety checkout: transfer cart items back to Storage!
      const storage = { ...get().storage };
      cart.slots.forEach((cSlot) => {
        const existing = storage.slots.find((s) => s.itemId === cSlot.itemId);
        if (existing) {
          existing.quantity += cSlot.quantity;
        } else {
          storage.slots.push({ itemId: cSlot.itemId, quantity: cSlot.quantity });
        }
      });
      cart.slots = [];

      set({ cart, storage });
      get().addLog("Kafra: Cart returned. All items inside transferred safely to Kafra Storage.", "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    spawnRandomGroundItem: (itemId, x, y) => {
      const ecs = get().ecsWorld;
      const player = ecs.getEntity(get().playerEntityId);
      const px = x !== undefined ? x : (player && player.components.position ? Math.round(player.components.position.x + (Math.random() * 4 - 2)) : 15);
      const py = y !== undefined ? y : (player && player.components.position ? Math.round(player.components.position.y + (Math.random() * 4 - 2)) : 15);

      const items = get().itemsCatalog;
      const chosenItem = itemId 
        ? items.find((i) => i.id === itemId) || items[0]
        : items[Math.floor(Math.random() * items.length)];

      const qty = chosenItem.type === "usable" || chosenItem.type === "etc" || chosenItem.type === "quest" ? Math.floor(Math.random() * 5) + 1 : 1;

      const newItem: GroundItem = {
        id: `g_${Math.random().toString(36).substring(4)}`,
        itemId: chosenItem.id,
        quantity: qty,
        x: px,
        y: py,
        droppedAt: Date.now()
      };

      set({ groundItems: [...get().groundItems, newItem] });
      get().addLog(`System: 🔮 Spawned ${qty}x ${chosenItem.name} on the floor at grid location: (${px}, ${py})!`, "system");
      set({ gameTickCount: get().gameTickCount + 1 });
    },

    tick: (deltaTime) => {
      const { ecsWorld, entityManager, gameTickCount } = get();

      // System 0: Decoupled World Runtime tick (handles revival delays and portal overlays checking)
      worldRuntime.tick(deltaTime * 1000, get());

      // System 1: Movement System & Coordinate updates
      const movingEntities = ecsWorld.queryEntities(["position"]);
      let didStateChange = false;

      for (const ent of movingEntities) {
        const pos = ent.components.position!;
        const rdr = ent.components.render;

        if (pos.targetX !== undefined && pos.targetY !== undefined) {
          // Walk animation triggering
          if (rdr && rdr.currentAnimation === "idle") {
            rdr.currentAnimation = "walk";
          }

          const oldX = pos.x;
          const oldY = pos.y;

          // Simple linear transition on grid toward target
          const dx = pos.targetX - pos.x;
          const dy = pos.targetY - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 0.1) {
            // Reached coord!
            pos.x = pos.targetX;
            pos.y = pos.targetY;

            // Follow next node in path if available
            if (pos.path && pos.path.length > 0) {
              const next = pos.path.shift()!;
              pos.targetX = next[0];
              pos.targetY = next[1];
            } else {
              pos.targetX = undefined;
              pos.targetY = undefined;
              if (rdr) {
                rdr.currentAnimation = "idle";
              }
            }
            didStateChange = true;
          } else {
            // Interpolate position based on Speed component
            const step = pos.speed * deltaTime;
            pos.x += (dx / dist) * step;
            pos.y += (dy / dist) * step;
            didStateChange = true;
          }

          // Keep physical coordinates synced within spatial partitioning indexes
          entityManager.updateSpatialIndex(ent.id, oldX, oldY);
        }
      }

      // System 2: Optimized monster AI wanderer (simply moves randomly every ~200 ticks)
      if (gameTickCount % 200 === 0) {
        // Query monsters in O(1) time using spatial/category indices instead of full scan!
        const monsters = entityManager.query({ type: "monster" });
        for (const mon of monsters) {
          const pos = mon.position;
          if (!pos.targetX && Math.random() > 0.70) {
            // pick relative tile within map limits dynamically
            const range = 3;
            const limitX = get().currentMap.width - 2;
            const limitY = get().currentMap.height - 2;
            const rx = Math.max(1, Math.min(limitX, Math.round(pos.x + (Math.random() * range * 2 - range))));
            const ry = Math.max(1, Math.min(limitY, Math.round(pos.y + (Math.random() * range * 2 - range))));
            
            const cell = get().currentMap.cells[ry]?.[rx];
            if (cell && cell.type !== 0) {
              pos.targetX = rx;
              pos.targetY = ry;
              if (mon.components.render) {
                mon.components.render.currentAnimation = "walk";
              }
              didStateChange = true;
            }
          }
        }
      }

      // System 4: Combat Core
      const combatants = ecsWorld.queryEntities(["combat", "stats", "position", "identity"]);
      const dtMs = deltaTime * 1000;
      
      for (const ent of combatants) {
        const combat = ent.components.combat!;
        
        // Skill Casting System
        if (combat.isCasting && combat.activeSkill) {
          combat.castProgress += dtMs;
          if (combat.castProgress >= combat.totalCastTime) {
            const skillDef = SKILLS_MAP.get(combat.activeSkill.id);
            if (skillDef) {
                const levelDef = skillDef.levels.find((l: any) => l.level === combat.activeSkill!.level);
                if (levelDef) {
                    const targetEnt = ecsWorld.getEntity(combat.activeSkill.targetId);
                    if (targetEnt && targetEnt.components.stats) {
                        const dmg = Math.floor((ent.components.stats!.str + (ent.components.stats!.int || 0)) * (levelDef.multiplier || 1.0));
                        targetEnt.components.stats.currentHp -= dmg;
                        get().addLog(`Battle: ${ent.components.identity!.name} used ${skillDef.name} on ${targetEnt.components.identity!.name} (${dmg} dmg)!`, "battle");
                    }
                }
            }
            
            combat.activeSkill = undefined;
            combat.isCasting = false;
            combat.castProgress = 0;
            if (ent.components.render) ent.components.render.currentAnimation = "idle";
          }
        }
        
        // TargetSystem
        if (ent.components.identity?.type === "monster" && !combat.targetEntityId) {
          const nearby = em.query({ near: { x: ent.components.position!.x, y: ent.components.position!.y, radius: 5 }, type: "player" });
          if (nearby.length > 0) combat.targetEntityId = nearby[0].id;
        }

        // AttackSystem & DamageSystem
        if (combat.targetEntityId) {
          const targetEnt = ecsWorld.getEntity(combat.targetEntityId);
          if (targetEnt && targetEnt.components.stats?.currentHp! > 0) {
             const tPos = targetEnt.components.position!;
             const pos = ent.components.position!;
             const dx = tPos.x - pos.x;
             const dy = tPos.y - pos.y;
             const distSq = dx * dx + dy * dy;
             
             if (distSq <= 1.5 * 1.5) {
                const now = Date.now();
                if (now - combat.lastAttackTime > combat.attackCooldown) {
                    combat.lastAttackTime = now;
                    if (ent.components.render) ent.components.render.currentAnimation = "attack";
                    
                    const attackerStats = ent.components.stats!;
                    const targetStats = targetEnt.components.stats!;
                    const minAtk = attackerStats.atkMin || 10;
                    const maxAtk = attackerStats.atkMax || 20;
                    const dmg = Math.floor(Math.random() * (maxAtk - minAtk + 1)) + minAtk;
                    
                    targetStats.currentHp -= dmg;
                    get().addLog(`Battle: ${ent.components.identity!.name} deals ${dmg} damage to ${targetEnt.components.identity!.name}!`, "battle");
                }
             }
          } else {
            combat.targetEntityId = undefined;
          }
        }
        
        // DeathSystem
        const fullEnt = em.get(ent.id);
        if (fullEnt && fullEnt.stats.currentHp <= 0 && fullEnt.state !== "die") {
           fullEnt.setState("die");
           if (ent.components.render) ent.components.render.currentAnimation = "die";
           get().addLog(`Battle: ${ent.components.identity!.name} died!`, "battle");
           
           // Drop System
           if (fullEnt.type === "monster") {
             const monsterEnt = fullEnt as MonsterEntity;
             for (const drop of monsterEnt.drops) {
               if (Math.random() < drop.rate) {
                 get().spawnRandomGroundItem(drop.itemId, ent.components.position!.x, ent.components.position!.y);
                 get().addLog(`Battle: ${monsterEnt.name} drops ${drop.itemId}!`, "battle");
               }
             }
           }
           
           combat.targetEntityId = undefined;
        }
      }

      // System Buffs: Decay active buffs remaining times
      let buffRecalcRequired = false;
      const actBuffs = get().activeBuffs || [];
      if (actBuffs.length > 0) {
        const updatedBuffs: ActiveBuff[] = [];
        const dtMs = deltaTime * 1000;
        for (const buff of actBuffs) {
          const nextTime = buff.remainingTimeMs - dtMs;
          if (nextTime > 0) {
            updatedBuffs.push({
              ...buff,
              remainingTimeMs: nextTime,
            });
          } else {
            // Buff expired! Let's log and trigger a statistics refresh
            get().addLog(`Buff: Effects of ${buff.name} have worn off.`, "system");
            buffRecalcRequired = true;
          }
        }
        set({ activeBuffs: updatedBuffs });
        if (buffRecalcRequired) {
          get().recalculatePlayerStats();
          didStateChange = true;
        }
      }

      // Re-render trigger update
      if (didStateChange || gameTickCount % 10 === 0) {
        set({ gameTickCount: gameTickCount + 1 });
      } else {
        set((state) => ({ gameTickCount: state.gameTickCount + 1 }));
      }
    },
  };
});
