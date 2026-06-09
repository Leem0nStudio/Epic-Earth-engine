"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "../core/store";
import { GameClock } from "../core/game-loop";
import { worldRuntime } from "../world/WorldLoader";
import { calculateCurrentWeight, checkWeightPenalties } from "../inventory/types";
import { getXpRequired } from "../jobs/types";
import { Plus, Power, RotateCcw, Swords, Shield, Heart, Zap, UserPlus } from "lucide-react";

// Dynamically load the R3F Canvas without server SSR to avoid Next.js compilation discrepancies
const ThreeCanvas = dynamic(() => import("./ThreeCanvas"), { ssr: false });

export default function GameClient() {
  const [clock] = useState(() => new GameClock());
  const [customName, setCustomName] = useState("Pro Ragnarok Hero");
  const [mounted, setMounted] = useState(false);
  
  // Bind store state
  const isInitializing = useGameStore((state) => state.isInitializing);
  const initializeGame = useGameStore((state) => state.initializeGame);
  const playerEntityId = useGameStore((state) => state.playerEntityId);
  const selectedEntityId = useGameStore((state) => state.selectedEntityId);
  const selectEntity = useGameStore((state) => state.selectEntity);
  const logs = useGameStore((state) => state.logs);
  const activeBuffs = useGameStore((state) => state.activeBuffs || []);
  const ecsWorld = useGameStore((state) => state.ecsWorld);
  const itemsCatalog = useGameStore((state) => state.itemsCatalog);
  const jobsCatalog = useGameStore((state) => state.jobsCatalog);
  const monstersCatalog = useGameStore((state) => state.monstersCatalog);
  const currentMap = useGameStore((state) => state.currentMap);
  const gameTickCount = useGameStore((state) => state.gameTickCount);
  const entityManager = useGameStore((state) => state.entityManager);

  // Core Actions
  const allocateStatPoint = useGameStore((state) => state.allocateStatPoint);
  const changeJobClass = useGameStore((state) => state.changeJobClass);
  const equipItem = useGameStore((state) => state.equipItem);
  const unequipItem = useGameStore((state) => state.unequipItem);
  const consumeItem = useGameStore((state) => state.consumeItem);
  const movePlayerTo = useGameStore((state) => state.movePlayerTo);
  const spawnMonster = useGameStore((state) => state.spawnMonster);
  const spawnNpc = useGameStore((state) => state.spawnNpc);
  const spawnPet = useGameStore((state) => state.spawnPet);
  const spawnSummon = useGameStore((state) => state.spawnSummon);
  const bulkSpawnStressTest = useGameStore((state) => state.bulkSpawnStressTest);
  const addLog = useGameStore((state) => state.addLog);
  const levelUpBase = useGameStore((state) => state.levelUpBase || (() => {}));
  const levelUpJob = useGameStore((state) => state.levelUpJob || (() => {}));
  const resetStatsAndJob = useGameStore((state) => state.resetStatsAndJob || (() => {}));

  // Separated Containers State & Actions bindings
  const storage = useGameStore((state) => state.storage);
  const cart = useGameStore((state) => state.cart);
  const groundItems = useGameStore((state) => state.groundItems || []);
  const depositToStorage = useGameStore((state) => state.depositToStorage);
  const withdrawFromStorage = useGameStore((state) => state.withdrawFromStorage);
  const depositToCart = useGameStore((state) => state.depositToCart);
  const withdrawFromCart = useGameStore((state) => state.withdrawFromCart);
  const dropItem = useGameStore((state) => state.dropItem);
  const pickUpGroundItem = useGameStore((state) => state.pickUpGroundItem);
  const rentCart = useGameStore((state) => state.rentCart);
  const unrentCart = useGameStore((state) => state.unrentCart);
  const spawnRandomGroundItem = useGameStore((state) => state.spawnRandomGroundItem);

  // Local mobile-prepared interactive panel states
  const [activeInventoryTab, setActiveInventoryTab] = useState<"inventory" | "storage" | "cart" | "ground">("inventory");
  const [itemCategoryFilter, setItemCategoryFilter] = useState<"all" | "equipment" | "usable" | "quest" | "etc">("all");
  const [transferQty, setTransferQty] = useState<number>(1);

  // Benchmarking spatial partitioning query
  const [benchElapsedMs, setBenchElapsedMs] = useState(0);
  const [benchMatches, setBenchMatches] = useState(0);

  // Track active spawn tab in Controllers
  const [activeSpawnType, setActiveSpawnType] = useState<"monster" | "npc" | "pet" | "summon" | "stress">("monster");

  // Job system active explorer states
  const [activeJobTierTab, setActiveJobTierTab] = useState<number>(1); // default to Tier 1
  const [bypassJobRestrictions, setBypassJobRestrictions] = useState<boolean>(true); // default to true for awesome tester freedom!

  useEffect(() => {
    const handle = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  // Game clock trigger loading
  useEffect(() => {
    initializeGame();
    clock.start();
    
    return () => {
      clock.stop();
    };
  }, [initializeGame, clock]);

  // Extract player entity details from the ECS instance
  const player = ecsWorld.getEntity(playerEntityId);
  const stats = player?.components.stats as any;
  const job = player?.components.job;
  const inventory = player?.components.inventory;
  const equipment = player?.components.equipment;
  const position = player?.components.position;

  const slots = inventory?.slots || [];

  const getFilteredInventoryItems = () => {
    return slots.filter((slot) => {
      const itemDef = itemsCatalog.find((i) => i.id === slot.itemId);
      if (!itemDef) return false;
      if (itemCategoryFilter === "all") return true;
      if (itemCategoryFilter === "equipment") {
        return ["weapon", "shield", "headgear_upper", "headgear_middle", "headgear_lower", "armor", "garment", "footwear", "accessory", "card"].includes(itemDef.type);
      }
      return itemDef.type === itemCategoryFilter;
    });
  };

  const getFilteredStorageItems = () => {
    return (storage?.slots || []).filter((slot) => {
      const itemDef = itemsCatalog.find((i) => i.id === slot.itemId);
      if (!itemDef) return false;
      if (itemCategoryFilter === "all") return true;
      if (itemCategoryFilter === "equipment") {
        return ["weapon", "shield", "headgear_upper", "headgear_middle", "headgear_lower", "armor", "garment", "footwear", "accessory", "card"].includes(itemDef.type);
      }
      return itemDef.type === itemCategoryFilter;
    });
  };

  const getFilteredCartItems = () => {
    return (cart?.slots || []).filter((slot) => {
      const itemDef = itemsCatalog.find((i) => i.id === slot.itemId);
      if (!itemDef) return false;
      if (itemCategoryFilter === "all") return true;
      if (itemCategoryFilter === "equipment") {
        return ["weapon", "shield", "headgear_upper", "headgear_middle", "headgear_lower", "armor", "garment", "footwear", "accessory", "card"].includes(itemDef.type);
      }
      return itemDef.type === itemCategoryFilter;
    });
  };

  useEffect(() => {
    // Run an automatic benchmark of the entity spatial hashing system on every state tick safely
    const pX = position?.x || 20;
    const pY = position?.y || 20;
    
    const token = setTimeout(() => {
      const t0 = window.performance.now();
      const results = entityManager.query({ near: { x: pX, y: pY, radius: 8 } });
      const t1 = window.performance.now();
      
      setBenchElapsedMs(t1 - t0);
      setBenchMatches(results.length);
    }, 0);

    return () => clearTimeout(token);
  }, [gameTickCount, position, entityManager]);

  // Selected details
  const selectedEntity = selectedEntityId ? ecsWorld.getEntity(selectedEntityId) : null;
  const selectedStats = selectedEntity?.components.stats;
  const selectedIdentity = selectedEntity?.components.identity;

  // Inventory stats calculations
  const currentWeight = calculateCurrentWeight(slots, itemsCatalog);
  const maxWeightLimit = 2000 + (stats?.str || 0) * 30; // RO styled: STR increases carrying capability!
  const penalties = checkWeightPenalties(currentWeight, maxWeightLimit);

  // Target class description
  const activeJobDesc = jobsCatalog.find((j) => j.id === job?.jobId);

  return (
    <div className="w-full h-screen bg-[#0c0d10] text-[#94a3b8] font-mono flex flex-col overflow-hidden select-none">
      
      {/* Top System Bar */}
      <div className="h-8 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4 text-[10px] uppercase tracking-wider shrink-0 select-none">
        <div className="flex gap-6 items-center">
          <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SERVER: LOCALHOST:4000
          </span>
          <span>UPTIME: 00:14:42</span>
          <span>WORLD_TICK: {gameTickCount}</span>
        </div>
        <div className="hidden sm:flex gap-6 items-center">
          <span className="text-blue-400">ZUSTAND_STORE: SYNCED</span>
          <span>FPS: 60.0</span>
          <span className="text-amber-500 font-bold">MEM: 142MB</span>
        </div>
      </div>

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Sidebar: Project Architecture (High-Density file-tree spec) */}
        <div className="hidden xl:flex w-56 bg-[#0d1117] border-r border-[#30363d] flex-col text-[11px] shrink-0">
          <div className="p-3 border-b border-[#30363d] text-slate-100 font-bold tracking-tight text-[12px]">PROJECT ARCHITECTURE</div>
          <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-0.5">
            <div className="flex items-center gap-2 px-2 py-1 text-slate-400 opacity-60">src/</div>
            <div className="flex items-center gap-2 px-4 py-1 text-emerald-400 bg-[#161b22] border border-[#30363d]/30 rounded">core/store.ts</div>
            <div className="flex items-center gap-2 px-4 py-0.5 text-slate-400">world/grid.ts</div>
            <div className="flex items-center gap-2 px-3.5 py-0.5 text-slate-500 italic">└ tiles.json</div>
            <div className="flex items-center gap-2 px-4 py-1 text-slate-400">entities/ecs.ts</div>
            <div className="flex items-center gap-2 px-4 py-1 text-blue-400">network/sockets</div>
            <div className="flex items-center gap-2 px-4 py-1 text-slate-400">ui/GameClient.tsx</div>
          </div>
          <div className="p-3 bg-[#161b22] border-t border-[#30363d]">
            <div className="text-[9px] uppercase text-slate-500 mb-2">Loaded Definitions</div>
            <div className="space-y-1 text-slate-400">
              <div className="flex justify-between"><span>Jobs:</span> <span className="text-white font-bold">{jobsCatalog.length}</span></div>
              <div className="flex justify-between"><span>Monsters:</span> <span className="text-white font-bold">{monstersCatalog.length}</span></div>
              <div className="flex justify-between"><span>Items:</span> <span className="text-white font-bold">{itemsCatalog.length}</span></div>
            </div>
          </div>
        </div>

        {/* 3D Scene Viewport / Stage */}
        <div className="flex-1 h-[40vh] lg:h-full relative overflow-hidden bg-black" id="viewport-frame">
          {isInitializing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c0d10] text-[#94a3b8]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4" />
              <p className="text-xs uppercase tracking-widest text-[#94a3b8]/60">LOADING MAP PROFILES & COLLISION MODELS...</p>
            </div>
          ) : (
            <ThreeCanvas />
          )}

          {/* Center Marker */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10">
            <div className="w-12 h-12 border border-blue-500/30 rounded-full flex items-center justify-center animate-pulse">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            </div>
          </div>

          {/* Floating Coordinates Overlay */}
          {position && (
            <div className="absolute bottom-4 left-4 bg-[#0d1117dd] border border-[#30363d] p-3 shadow-xl backdrop-blur-sm max-w-sm text-[11px] z-10 pointer-events-auto">
              <div className="text-[10px] text-blue-400 font-bold mb-1.5 uppercase tracking-wider">
                📍 Coordinates Locator
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
                <div>Map ID: <span className="text-white">{currentMap.id}</span></div>
                <div>X Coord: <span className="text-emerald-400 font-bold">{Math.round(position.x)}</span></div>
                <div>Y Coord: <span className="text-emerald-400 font-bold">{Math.round(position.y)}</span></div>
                <div>Elevation: <span className="text-white">{position.z.toFixed(2)}</span></div>
              </div>
              <p className="text-[9px] text-slate-500 mt-2 bg-[#161b22] px-1.5 py-0.5 border border-[#30363d]">
                💡 Mouse-drag to rotate scene. Click floor to guide our hero.
              </p>
            </div>
          )}

          {/* Grid HUD Selection Indicator lock overlay */}
          {selectedIdentity && selectedStats && (
            <div className="absolute top-4 left-4 bg-[#0d1117dd] border border-[#30363d] p-3 shadow-2xl backdrop-blur-sm w-64 z-10 pointer-events-auto">
              <div className="flex justify-between items-start border-b border-[#30363d] pb-2 mb-2">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-red-400 font-bold">
                    Target Information Lock
                  </span>
                  <h4 className="text-xs font-bold text-white mt-0.5">{selectedIdentity.name}</h4>
                </div>
                <button
                  onClick={() => selectEntity(null)}
                  className="text-slate-400 hover:text-white text-[10px] bg-[#161b22] border border-[#30363d] px-2 py-0.5 rounded transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-2 text-[11px]">
                {/* Target Health Bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>HP STATUS</span>
                    <span>{selectedStats.currentHp} / {selectedStats.maxHp}</span>
                  </div>
                  <div className="w-full h-3 bg-[#0c0d10] border border-[#30363d] p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-rose-400 transition-all duration-150"
                      style={{ width: `${(selectedStats.currentHp / selectedStats.maxHp) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-300 pt-1.5 border-t border-[#30363d]">
                  <div>STR: <span className="text-slate-100">{selectedStats.str}</span></div>
                  <div>AGI: <span className="text-slate-100">{selectedStats.agi}</span></div>
                  <div>VIT: <span className="text-slate-100">{selectedStats.vit}</span></div>
                  <div>DEF: <span className="text-slate-100">{selectedStats.defHard}+{selectedStats.defSoft}</span></div>
                  <div>FLEE: <span className="text-blue-400 font-bold">{selectedStats.flee}</span></div>
                  <div>ASPD: <span className="text-emerald-400 font-bold">{selectedStats.aspd}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2D Dashboard Panels sidebar */}
        <div className="w-full lg:w-[480px] h-[60vh] lg:h-full border-t lg:border-t-0 lg:border-l border-[#30363d] bg-[#0c0d10] overflow-y-auto flex flex-col shadow-2xl z-20">
          
          {/* Character status header Card */}
          <div className="p-4 bg-[#161b22] border-b border-[#30363d] flex flex-col gap-3">
            {stats && job && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-[#0d1117] border border-[#30363d] flex items-center justify-center text-sm font-bold text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                    ⚔️
                  </div>
                  <div>
                    <span className="text-[9px] text-[#38bdf8] font-bold tracking-widest leading-none block">CORE_PLAYER_REPLICANT</span>
                    <h2 className="text-xs font-bold text-slate-100 mt-1 uppercase">{player?.components.identity!.name}</h2>
                    <p className="text-[11px] text-emerald-400 font-bold mt-0.5">JOB_CLASS: {activeJobDesc?.name || "Novice"}</p>
                  </div>
                </div>

                {/* Levels */}
                <div className="grid grid-cols-2 gap-3 text-[10px] uppercase border-y border-[#30363d] py-2">
                  <div>
                    <div className="flex justify-between items-center mb-1 text-slate-400">
                      <span>BASE_LV <span className="text-white font-bold font-mono">({job.baseLevel})</span></span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => levelUpBase(1)}
                          className="px-1 text-[8px] bg-[#161b22] border border-[#30363d] rounded text-emerald-400 hover:text-white"
                          title="Level Up Base by 1"
                        >
                          +1
                        </button>
                        <button 
                          onClick={() => levelUpBase(10)}
                          className="px-1 text-[8px] bg-[#161b22] border border-[#30363d] rounded text-emerald-300 hover:text-white"
                          title="Level Up Base by 10"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-[#0c0d10] border border-[#30363d] overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (job.baseLevel % 10) * 10 || 10)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1 text-slate-400">
                      <span>JOB_LV <span className="text-white font-bold font-mono">({job.jobLevel}/{activeJobDesc?.maxJobLevel})</span></span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => levelUpJob(1)}
                          className="px-1 text-[8px] bg-[#161b22] border border-[#30363d] rounded text-blue-400 hover:text-white"
                          title="Level Up Job by 1"
                        >
                          +1
                        </button>
                        <button 
                          onClick={() => levelUpJob(10)}
                          className="px-1 text-[8px] bg-[#161b22] border border-[#30363d] rounded text-blue-300 hover:text-white"
                          title="Level Up Job by 10"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-[#0c0d10] border border-[#30363d] overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all" style={{ width: `${(job.jobLevel / (activeJobDesc?.maxJobLevel || 50)) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* Status Bars HP / SP */}
                <div className="space-y-2 text-[10px]">
                  <div>
                    <div className="flex justify-between items-center text-slate-300 font-bold mb-1">
                      <span className="flex items-center gap-1 text-red-400">■ HP_VOLUME</span>
                      <span>{stats.currentHp} / {stats.maxHp}</span>
                    </div>
                    <div className="w-full h-3 bg-[#0c0d10] border border-[#30363d] p-0.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)] transition-all"
                        style={{ width: `${(stats.currentHp / stats.maxHp) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-slate-300 font-bold mb-1">
                      <span className="flex items-center gap-1 text-blue-400">■ SP_VOLUME</span>
                      <span>{stats.currentSp} / {stats.maxSp}</span>
                    </div>
                    <div className="w-full h-3 bg-[#0c0d10] border border-[#30363d] p-0.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.5)] transition-all"
                        style={{ width: `${(stats.currentSp / stats.maxSp) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Active Buffs Indicators */}
                {activeBuffs.length > 0 && (
                  <div className="pt-2 border-t border-[#30363d]/40 mt-1">
                    <div className="text-[9px] text-[#38bdf8] font-bold tracking-wider mb-1.5 flex items-center gap-1 uppercase">
                      ⚡ ACTIVE_BUFFS
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeBuffs.map((b) => {
                        const pct = Math.max(0, Math.min(100, (b.remainingTimeMs / b.totalTimeMs) * 100));
                        return (
                          <div 
                            key={b.id} 
                            className="bg-[#0f141c] border border-[#30363d] rounded px-2 py-1 text-[10px] flex items-center gap-1.5 relative overflow-hidden shrink-0"
                            title={`${b.name} (${(b.remainingTimeMs / 1000).toFixed(1)}s)`}
                          >
                            <span className="text-sm shrink-0 leading-none">{b.icon}</span>
                            <div className="flex flex-col min-w-0">
                              <span className="text-slate-100 font-bold leading-none truncate max-w-[90px]">{b.name}</span>
                              <span className="text-[8px] text-[#38bdf8] font-mono mt-0.5 leading-none">
                                {(b.remainingTimeMs / 1000).toFixed(0)}s
                              </span>
                            </div>
                            <div 
                              className="absolute bottom-0 left-0 h-0.5 bg-blue-500/50 transition-all duration-100" 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Double column grid tabs for derived specs and active variables */}
          <div className="p-3 grid grid-cols-2 gap-3 border-b border-[#30363d] bg-[#0c0d10]" id="parameters-and-attributes">
            {stats && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 bg-[#161b22] px-2 py-1 border border-[#30363d]">
                  ■ DERIVED_SPECS
                </h3>
                <div className="space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>ATK:</span>
                    <span className="text-white font-semibold">{stats.atkMin} - {stats.atkMax}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DEF (H+S):</span>
                    <span className="text-white font-semibold">{stats.defHard}%+{stats.defSoft}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>M.DEF:</span>
                    <span className="text-white font-semibold">{stats.mdefHard}%+{stats.mdefSoft}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HIT:</span>
                    <span className="text-white font-semibold">{stats.hit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FLEE:</span>
                    <span className="text-blue-400 font-semibold">{stats.flee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CRIT:</span>
                    <span className="text-amber-500 font-semibold">{stats.crit}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ASPD:</span>
                    <span className="text-emerald-400 font-semibold">{stats.aspd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CAST_RED:</span>
                    <span className="text-purple-400 font-semibold">{((1 - stats.castTimeMultiplier) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )}

            {stats && job && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 bg-[#161b22] px-2 py-1 border border-[#30363d]">
                  ✚ ALLOCATE_ATTR
                </h3>
                <div className="space-y-1.5 text-[10px]">
                  {(["str", "agi", "vit", "int", "dex", "luk"] as const).map((attr) => {
                    const baseVal = stats.breakdown?.base?.[attr] ?? stats[attr] ?? 9;
                    const equipVal = stats.breakdown?.equip?.[attr] ?? 0;
                    const buffVal = stats.breakdown?.buff?.[attr] ?? 0;
                    const bonusVal = equipVal + buffVal;

                    return (
                      <div key={attr} className="flex items-center justify-between py-0.5 border-b border-[#30363d]/30 group hover:bg-[#161b22]/30 px-1 rounded transition-colors" title={`Base Stat: ${baseVal} | Equip Bonus: +${equipVal} | Buff Bonus: +${buffVal}`}>
                        <div className="flex flex-col min-w-0">
                          <span className="uppercase text-slate-300 font-bold">{attr}</span>
                          <span className="text-[8px] text-slate-500 font-mono hidden group-hover:block transition-all truncate leading-none mt-0.5">
                            B:{baseVal} | E:+{equipVal} | Bf:+{buffVal}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-semibold mr-1.5 font-mono text-[11px]">
                            {baseVal}
                            {bonusVal > 0 && (
                              <span className="text-emerald-400 font-bold ml-1">
                                +{bonusVal}
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => allocateStatPoint(attr)}
                            className="h-4 w-4 bg-[#161b22] hover:bg-[#30363d] border border-[#30363d] text-emerald-400 hover:text-white rounded flex items-center justify-center font-bold text-xs transition-all"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Advanced Separated Inventory Containers System (Mobile-Prepared, Data-Driven) */}
          <div className="p-3 border-b border-[#30363d] bg-[#0c0d10] flex-1 flex flex-col overflow-hidden min-h-[360px]" id="inventory-system-container">
            {/* Header Title with Container Tabs */}
            <div className="flex flex-col gap-2 mb-2 border-b border-[#30363d] pb-2">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  🎒 COMPONENT_BAGS_STATION
                </h4>
                <div className="text-[9px] text-amber-400 bg-amber-950/20 border border-amber-500/20 px-2 py-0.5 font-semibold">
                  Qty Selection: <span className="text-white font-mono">{transferQty}x</span>
                </div>
              </div>

              {/* High-Fidelity Mobile Container Tabs */}
              <div className="grid grid-cols-4 gap-1">
                {(["inventory", "storage", "cart", "ground"] as const).map((tab) => {
                  let emoji = "💼";
                  let label = "Bag";
                  let countInfo = "";
                  
                  if (tab === "inventory") {
                    emoji = "💼";
                    label = "Inv";
                    countInfo = `(${slots.length})`;
                  } else if (tab === "storage") {
                    emoji = "🏦";
                    label = "Bank";
                    countInfo = `(${storage?.slots?.length || 0})`;
                  } else if (tab === "cart") {
                    emoji = "🛒";
                    label = "Cart";
                    countInfo = cart?.hasCart ? `(${cart.slots.length})` : "(OFF)";
                  } else if (tab === "ground") {
                    emoji = "🗺️";
                    label = "Floor";
                    countInfo = `(${groundItems.length})`;
                  }

                  const isActive = activeInventoryTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveInventoryTab(tab)}
                      className={`text-[9.5px] py-1.5 border rounded flex flex-col items-center justify-center font-bold gap-0.5 transition-all outline-none ${
                        isActive
                          ? "bg-[#1f2937] border-[#fbbf24] text-[#fbbf24] shadow-md shadow-[#fbbf24]/5"
                          : "bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-white hover:border-[#444c56]"
                      }`}
                      style={{ touchAction: "manipulation" }}
                    >
                      <span className="text-xs">{emoji}</span>
                      <span className="truncate w-full text-center leading-none mt-0.5">{label} {countInfo}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Multipliers / Selection Quantities - Touch Friendly */}
            <div className="flex items-center justify-between bg-[#161b22] border border-[#30363d] px-2 py-1 rounded mb-2 text-[10px]">
              <span className="text-slate-400 font-medium">Operation Qty:</span>
              <div className="flex gap-1">
                {([1, 5, 10, 50] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setTransferQty(v)}
                    className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold transition-all ${
                      transferQty === v
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                        : "bg-slate-900 border-transparent text-slate-400 hover:text-white"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Category Filter Row - Touch Friendly */}
            <div className="flex gap-1 overflow-x-auto pb-1.5 mb-2 border-b border-[#30363d]/50 scrollbar-none">
              {(["all", "equipment", "usable", "quest", "etc"] as const).map((cat) => {
                let badge = cat.toUpperCase();
                if (cat === "equipment") badge = "⚔️ EQUIP";
                else if (cat === "usable") badge = "🧪 USE";
                else if (cat === "quest") badge = "🔱 QUEST";
                else if (cat === "all") badge = "📂 ALL";
                else if (cat === "etc") badge = "📦 ETC";

                const isSelected = itemCategoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setItemCategoryFilter(cat)}
                    className={`text-[8.5px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap border shrink-0 transition-all ${
                      isSelected
                        ? "bg-sky-500/10 border-sky-400/40 text-sky-400"
                        : "bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {badge}
                  </button>
                );
              })}
            </div>

            {/* Active Inventory Penalities overlay info */}
            {activeInventoryTab === "inventory" && penalties.regenerationDisabled && (
              <p className="bg-amber-950/20 border border-amber-600/30 text-amber-200 text-[9px] px-2 py-1 mb-2 leading-tight rounded">
                ⚠️ OVERWEIGHT LIMIT: Natural HP/SP health regenerations disabled. (Weight: {currentWeight}/{maxWeightLimit})
              </p>
            )}

            {/* Tab Containers Rendering Section */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[280px] space-y-1.5 pr-1 text-[11px] select-none">
              
              {/* TAB 1: Main Core Inventory */}
              {activeInventoryTab === "inventory" && (
                <>
                  <div className="flex justify-between items-center text-[9px] text-slate-500 border-b border-[#30363d]/30 pb-1 mb-1 px-1">
                    <span>Active Bag Inventory List</span>
                    <span>Weight: <strong className="text-white">{currentWeight}</strong> / {maxWeightLimit} kg</span>
                  </div>

                  {getFilteredInventoryItems().length === 0 ? (
                    <div className="text-center text-slate-500 py-10 border border-dashed border-[#30363d] rounded">
                      No matching items in your main inventory.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {getFilteredInventoryItems().map((slot) => {
                        const itemDef = itemsCatalog.find((i) => i.id === slot.itemId);
                        if (!itemDef) return null;
                        const isEquipped = slot.isEquipped;

                        let itemEmoji = "📦";
                        if (itemDef.type === "usable") itemEmoji = "🧪";
                        else if (itemDef.type === "weapon") itemEmoji = "⚔️";
                        else if (itemDef.type === "shield" || itemDef.type === "headgear_upper") itemEmoji = "🛡️";
                        else if (itemDef.type === "quest") itemEmoji = "🔱";

                        return (
                          <div
                            key={slot.slotId}
                            className={`flex flex-col p-2 border rounded-md transition-all ${
                              isEquipped
                                ? "bg-indigo-950/20 border-indigo-500/50"
                                : "bg-[#0d1117] border-[#30363d] hover:border-slate-500"
                            }`}
                          >
                            {/* Title line */}
                            <div className="flex justify-between items-start">
                              <div className="flex gap-2 items-center min-w-0">
                                <span className="text-sm">{itemEmoji}</span>
                                <div className="truncate">
                                  <h5 className="font-bold text-white text-[11px] truncate flex items-center gap-1">
                                    {itemDef.name}
                                    {slot.quantity > 1 && <span className="text-sky-400">x{slot.quantity}</span>}
                                    {isEquipped && <span className="text-[8px] bg-indigo-500/20 text-indigo-300 font-extrabold px-1 border border-indigo-500/30 uppercase rounded">Equipped</span>}
                                  </h5>
                                  <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{itemDef.description}</p>
                                </div>
                              </div>
                              <span className="text-[9px] text-slate-500 font-mono italic shrink-0">
                                {itemDef.weight * slot.quantity} kg
                              </span>
                            </div>

                            {/* Dynamic Actions Row */}
                            <div className="flex flex-wrap gap-1 mt-2 border-t border-[#30363d]/50 pt-2 justify-end">
                              {/* Classic Consume/Equip Actions */}
                              {itemDef.type === "usable" ? (
                                <button
                                  onClick={() => consumeItem(itemDef.id)}
                                  className="text-[9px] text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-1 rounded border border-sky-400/20 font-bold uppercase transition-all"
                                >
                                  Consume
                                </button>
                              ) : ["weapon", "shield", "headgear_upper", "headgear_middle", "headgear_lower", "armor", "garment", "footwear", "accessory"].includes(itemDef.type) ? (
                                <button
                                  onClick={() => (isEquipped ? unequipItem(itemDef.id) : equipItem(itemDef.id))}
                                  className={`text-[9px] px-2 py-1 rounded border font-bold uppercase transition-all ${
                                    isEquipped
                                      ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                                      : "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-400/20"
                                  }`}
                                >
                                  {isEquipped ? "Unequip" : "Equip"}
                                </button>
                              ) : null}

                              {/* Deposition to storage */}
                              {!isEquipped && (
                                <button
                                  onClick={() => depositToStorage(itemDef.id, Math.min(transferQty, slot.quantity))}
                                  className="text-[9px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded border border-emerald-400/20 font-medium transition-all"
                                  title="Deposit to Kafra Storage"
                                >
                                  🏦 Deposit
                                </button>
                              )}

                              {/* Deposition to Cart */}
                              {!isEquipped && cart?.hasCart && (
                                <button
                                  onClick={() => depositToCart(itemDef.id, Math.min(transferQty, slot.quantity))}
                                  className="text-[9px] text-amber-400 bg-amber-500/5 hover:bg-amber-500/15 px-2 py-1 rounded border border-amber-500/20 font-medium transition-all"
                                  title="Load into Merchant Cart"
                                >
                                  🛒 Load Cart
                                </button>
                              )}

                              {/* Drop to floor item */}
                              {!isEquipped && (
                                <button
                                  onClick={() => dropItem(itemDef.id, Math.min(transferQty, slot.quantity))}
                                  className="text-[9px] text-rose-400 bg-rose-500/5 hover:bg-rose-500/15 px-2 py-1 rounded border border-rose-500/20 font-medium transition-all"
                                  title="Drop item on floor"
                                >
                                  🗑️ Drop
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: Kafra Storage */}
              {activeInventoryTab === "storage" && (
                <>
                  <div className="flex justify-between items-center text-[9px] text-slate-500 border-b border-[#30363d]/30 pb-1 mb-1 px-1">
                    <span>Vault Lockers Bank (Kafra Locker)</span>
                    <span>Slots used: <strong className="text-white">{storage?.slots?.length || 0}</strong> / {storage?.maxSlots || 200}</span>
                  </div>

                  {getFilteredStorageItems().length === 0 ? (
                    <div className="text-center text-slate-500 py-10 border border-dashed border-[#30363d] rounded">
                      Storage vault space is empty. Deposit items from your Inventory tab.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {getFilteredStorageItems().map((sSlot, index) => {
                        const itemDef = itemsCatalog.find((i) => i.id === sSlot.itemId);
                        if (!itemDef) return null;

                        let itemEmoji = "📦";
                        if (itemDef.type === "usable") itemEmoji = "🧪";
                        else if (itemDef.type === "weapon") itemEmoji = "⚔️";
                        else if (itemDef.type === "shield" || itemDef.type === "headgear_upper") itemEmoji = "🛡️";
                        else if (itemDef.type === "quest") itemEmoji = "🔱";

                        return (
                          <div
                            key={`storage-${sSlot.itemId}-${index}`}
                            className="flex justify-between items-center p-2 border border-[#30363d] bg-[#0d1117] rounded-md hover:border-slate-500"
                          >
                            <div className="flex gap-2 items-center min-w-0">
                              <span className="text-sm">{itemEmoji}</span>
                              <div className="truncate">
                                <h5 className="font-bold text-white text-[11px] truncate flex items-center gap-1.5">
                                  {itemDef.name}
                                  <span className="text-emerald-400 font-mono">x{sSlot.quantity}</span>
                                </h5>
                                <p className="text-[9px] text-slate-500 mt-0.5 leading-none">{itemDef.description}</p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => withdrawFromStorage(itemDef.id, Math.min(transferQty, sSlot.quantity))}
                              className="text-[9px] text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-1 rounded border border-sky-400/20 shrink-0 font-bold uppercase transition-all"
                            >
                              Withdraw
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* TAB 3: Merchant Cart */}
              {activeInventoryTab === "cart" && (
                <>
                  {/* Cart Status Banner */}
                  <div className="bg-[#161b22] border border-[#30363d] p-2.5 rounded-lg mb-2 flex justify-between items-center">
                    <div className="min-w-0">
                      <h5 className="text-[10px] font-extrabold uppercase text-amber-500 tracking-wider">
                        🛒 kafra_cart_system
                      </h5>
                      <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                        {cart?.hasCart 
                          ? "Custom Merchant Cart is mounted. Heavy items loads carry active."
                          : "No active Cart. Rent one below to load etc & equipment slots."}
                      </p>
                    </div>

                    <button
                      onClick={cart?.hasCart ? unrentCart : rentCart}
                      className={`text-[9px] font-extrabold uppercase px-2.5 py-1.5 rounded-md border shrink-0 transition-all ${
                        cart?.hasCart 
                          ? "bg-rose-500/15 border-rose-500/35 text-rose-400 hover:bg-rose-500/20"
                          : "bg-amber-500/15 border-amber-500/35 text-amber-300 hover:bg-amber-500/25"
                      }`}
                    >
                      {cart?.hasCart ? "Return Cart" : "Rent Cart"}
                    </button>
                  </div>

                  {cart?.hasCart && (
                    <>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 border-b border-[#30363d]/30 pb-1 mb-1 px-1">
                        <span>Cart Inventory Slots</span>
                        <span>Weight capacity: <strong className="text-white">8000</strong> max</span>
                      </div>

                      {getFilteredCartItems().length === 0 ? (
                        <div className="text-center text-slate-500 py-10 border border-dashed border-[#30363d] rounded">
                          Your mounted Cart is completely empty. Load items into it from your Inventory tab!
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {getFilteredCartItems().map((cSlot, index) => {
                            const itemDef = itemsCatalog.find((i) => i.id === cSlot.itemId);
                            if (!itemDef) return null;

                            let itemEmoji = "📦";
                            if (itemDef.type === "usable") itemEmoji = "🧪";
                            else if (itemDef.type === "weapon") itemEmoji = "⚔️";
                            else if (itemDef.type === "shield" || itemDef.type === "headgear_upper") itemEmoji = "🛡️";
                            else if (itemDef.type === "quest") itemEmoji = "🔱";

                            return (
                              <div
                                key={`cart-${cSlot.itemId}-${index}`}
                                className="flex justify-between items-center p-2 border border-[#30363d] bg-[#0d1117] rounded-md hover:border-slate-500"
                              >
                                <div className="flex gap-2 items-center min-w-0">
                                  <span className="text-sm">{itemEmoji}</span>
                                  <div className="truncate">
                                    <h5 className="font-bold text-white text-[11px] truncate flex items-center gap-1.5">
                                      {itemDef.name}
                                      <span className="text-amber-500 font-mono">x{cSlot.quantity}</span>
                                    </h5>
                                    <p className="text-[9px] text-slate-500 mt-0.5 leading-none">{itemDef.description}</p>
                                  </div>
                                </div>
                                
                                <button
                                  onClick={() => withdrawFromCart(itemDef.id, Math.min(transferQty, cSlot.quantity))}
                                  className="text-[9px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded border border-amber-400/20 shrink-0 font-bold uppercase transition-all"
                                >
                                  Unload
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* TAB 4: Ground Floor Items Locker */}
              {activeInventoryTab === "ground" && (
                <>
                  <div className="flex justify-between items-center text-[9px] text-slate-500 mb-2 px-1">
                    <span>Floor Area Loot Controller (Grid Projections)</span>
                    <button
                      onClick={() => spawnRandomGroundItem()}
                      className="bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:text-white px-2 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider transition-all"
                    >
                      🔮 SPAWN LOOT FLOOR
                    </button>
                  </div>

                  {groundItems.length === 0 ? (
                    <div className="text-center text-slate-500 py-10 border border-dashed border-[#30363d] rounded">
                      The immediate ground floor is clean. No items dropped yet. Use the button above or drop items from your Inventory tab!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {groundItems.map((g) => {
                        const itemDef = itemsCatalog.find((i) => i.id === g.itemId);
                        if (!itemDef) return null;

                        let itemEmoji = "📦";
                        if (itemDef.type === "usable") itemEmoji = "🧪";
                        else if (itemDef.type === "weapon") itemEmoji = "⚔️";
                        else if (itemDef.type === "shield" || itemDef.type === "headgear_upper") itemEmoji = "🛡️";
                        else if (itemDef.type === "quest") itemEmoji = "🔱";

                        return (
                          <div
                            key={g.id}
                            className="flex justify-between items-center p-2 border border-amber-500/20 bg-amber-950/5 rounded-md hover:border-amber-400/40"
                          >
                            <div className="flex gap-2 items-center min-w-0">
                              <span className="text-sm shrink-0 leading-none">{itemEmoji}</span>
                              <div className="truncate">
                                <h5 className="font-extrabold text-amber-300 text-[11px] truncate flex items-center gap-1.5 leading-none">
                                  {itemDef.name}
                                  {g.quantity > 1 && <span className="text-slate-400">x{g.quantity}</span>}
                                </h5>
                                <p className="text-[8px] text-slate-400 mt-1 uppercase font-mono leading-none">Coordinates: ({g.x}, {g.y})</p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => pickUpGroundItem && pickUpGroundItem(g.id)}
                              className="text-[9px] text-[#fbbf24] bg-amber-500/10 hover:bg-[#fbbf24] hover:text-black px-2.5 py-1.5 rounded border border-[#fbbf24]/30 shrink-0 font-extrabold uppercase transition-all"
                            >
                              🛍️ Loot
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

            </div>
          </div>

          {/* World Map Navigator (Directly loading and navigating editor-exported JSONs) */}
          <div className="p-3 bg-[#0c0d10] border-b border-[#30363d] space-y-2">
            <h4 className="text-[10px] font-bold uppercase text-slate-400 flex justify-between items-center bg-[#161b22] px-2 py-1 border border-[#30363d]">
              <span>🗺️ WORLD_RUN_NAVIGATOR</span>
              <span className="text-[9px] text-sky-400 font-mono">ACTIVE_RUNTIME</span>
            </h4>
            
            <p className="text-[9px] text-slate-400 leading-normal">
              Travel seamlessly using portals on map edges, or test transitions instantly:
            </p>

            <div className="grid grid-cols-3 gap-1">
              {[
                { id: "prontera_south", label: "South Field", emoji: "🌱", color: "hover:border-emerald-500" },
                { id: "prontera_city", label: "Prontera", emoji: "🏰", color: "hover:border-sky-500" },
                { id: "dungeon_f1", label: "Dungeon F1", emoji: "💀", color: "hover:border-red-500" },
              ].map((m) => {
                const isActive = currentMap.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      useGameStore.getState().loadMap(m.id);
                    }}
                    className={`text-[9px] py-1.5 border rounded flex flex-col items-center justify-center font-bold gap-1 transition-all ${
                      isActive
                        ? "bg-[#161b22] border-emerald-500/50 text-emerald-400 pointer-events-none opacity-100"
                        : "bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-white"
                    } ${m.color}`}
                  >
                    <span className="text-sm">{m.emoji}</span>
                    <span className="truncate w-full text-center px-1">{m.label}</span>
                  </button>
                );
              })}
            </div>
            
            <div className="bg-[#0d1117] border border-[#30363d] p-2 rounded text-[10px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Active Subzone:</span>
                <span className="text-white font-semibold flex items-center gap-1">
                  📍 {position 
                    ? (worldRuntime.regionManager.getRegionAt(position.x, position.y)?.name || "Wild Wilderness") 
                    : "Unknown"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Zone Safety Status:</span>
                <span className="font-bold flex items-center gap-1 text-[9px]">
                  {(() => {
                    if (!position) return <span className="text-slate-400">Unknown</span>;
                    const regType = worldRuntime.regionManager.getRegionAt(position.x, position.y)?.type || "field";
                    switch(regType) {
                      case "safezone":
                      case "town":
                        return <span className="text-emerald-400 font-bold">🛡️ SANCTUARY (SAFE)</span>;
                      case "pvp":
                        return <span className="text-red-500 font-bold animate-pulse">⚔️ COMBAT ZONE (PVP)</span>;
                      case "dungeon":
                        return <span className="text-purple-400 font-bold">💀 DANGEROUS DUNGEON</span>;
                      default:
                        return <span className="text-yellow-400 font-semibold">🌾 WILDERNESS FIELD</span>;
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Development Controls */}
          <div className="p-3 bg-[#0c0d10] border-b border-[#30363d] space-y-2.5">
            <h4 className="text-[10px] font-bold uppercase text-slate-400 flex justify-between items-center bg-[#161b22] px-2 py-1 border border-[#30363d]">
              <span>⚙️ OPERATIONAL_CONTROLLERS</span>
              <span className="text-[9px] text-indigo-400 font-mono">ENTITIES: {entityManager.count()}</span>
            </h4>
            
            <div className="space-y-2.5">
              {/* Ragnarok Job Succession & Progression Visualizer */}
              <div className="border border-[#30363d]/60 bg-[#0c0d10] p-2.5 rounded space-y-2">
                <div className="flex justify-between items-center border-b border-[#30363d]/60 pb-1.5 gap-2">
                  <span className="text-[9.5px] uppercase font-bold text-[#c084fc] tracking-wider flex items-center gap-1 shrink-0">
                    👑 CLASS_HIERARCHY
                  </span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <label className="text-[8px] text-amber-500 font-bold tracking-wider uppercase flex items-center gap-0.5 cursor-pointer select-none shrink-0" title="Bypass requirement checks to instantly promote to any class">
                      <input 
                        type="checkbox" 
                        checked={bypassJobRestrictions} 
                        onChange={(e) => setBypassJobRestrictions(e.target.checked)}
                        className="rounded border-[#30363d] bg-[#161b22] text-amber-500 w-2.5 h-2.5 cursor-pointer ml-0.5"
                      />
                      BYPASS
                    </label>
                    <button
                      onClick={() => resetStatsAndJob()}
                      className="px-1 py-0.5 rounded bg-red-600/10 hover:bg-red-600/25 border border-red-500/30 text-[8px] text-red-300 font-bold transition-all shrink-0 uppercase"
                      title="Fully reset to Novice Base Level 1 with starting stats"
                    >
                      RESET
                    </button>
                  </div>
                </div>

                {/* Class Tier Tabs */}
                <div className="grid grid-cols-5 gap-0.5 bg-[#161b22] p-0.5 rounded border border-[#30363d]/50">
                  {[
                    { tier: 0, label: "T0: Novice" },
                    { tier: 1, label: "T1: First" },
                    { tier: 2, label: "T2: Second" },
                    { tier: 3, label: "T3: Trans" },
                    { tier: 4, label: "T4: Third" }
                  ].map((tab) => (
                    <button
                      key={tab.tier}
                      onClick={() => setActiveJobTierTab(tab.tier)}
                      className={`text-[8.5px] py-1 font-bold uppercase rounded transition-all leading-none ${
                        activeJobTierTab === tab.tier
                          ? "bg-purple-900/50 border border-purple-500/40 text-purple-200 font-extrabold shadow-sm"
                          : "text-slate-400 hover:text-slate-200 bg-transparent border border-transparent"
                      }`}
                    >
                      {tab.label.split(": ")[1]}
                    </button>
                  ))}
                </div>

                {/* Dynamic Jobs Catalog List */}
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                  {(() => {
                    const filteredJobs = jobsCatalog.filter((j) => j.tier === activeJobTierTab);
                    if (filteredJobs.length === 0) {
                      return <p className="text-[8.5px] text-slate-500 italic text-center py-2">No jobs found in this tier category.</p>;
                    }

                    return filteredJobs.map((j) => {
                      const isCurrent = job?.jobId === j.id;
                      
                      // Resolve job icon dynamically based on id/class
                      let classIcon = "🔰";
                      if (j.id.includes("swordman") || j.id.includes("knight")) classIcon = "⚔️";
                      else if (j.id.includes("mage") || j.id.includes("wizard") || j.id.includes("warlock")) classIcon = "🪄";
                      else if (j.id.includes("archer") || j.id.includes("hunter") || j.id.includes("sniper") || j.id.includes("ranger")) classIcon = "🏹";
                      else if (j.id.includes("merchant") || j.id.includes("smith") || j.id.includes("mechanic")) classIcon = "💰";
                      else if (j.id.includes("acolyte") || j.id.includes("priest") || j.id.includes("bishop")) classIcon = "✝️";
                      else if (j.id.includes("thief") || j.id.includes("assassin") || j.id.includes("rogue") || j.id.includes("cross")) classIcon = "🥷";

                      // Determine if requirements are satisfied
                      const parentJobName = j.parentJobId 
                        ? (jobsCatalog.find((p) => p.id === j.parentJobId)?.name || j.parentJobId)
                        : null;
                      
                      const parentMatches = !j.parentJobId || (job?.jobId === j.parentJobId);
                      const baseLvlMatches = !j.requiredBaseLevel || ((job?.baseLevel ?? 1) >= j.requiredBaseLevel);
                      const jobLvlMatches = !j.requiredJobLevel || ((job?.jobLevel ?? 1) >= j.requiredJobLevel);
                      
                      const metRequirements = parentMatches && baseLvlMatches && jobLvlMatches;
                      const canPromote = isCurrent ? false : (bypassJobRestrictions || metRequirements);

                      return (
                        <div 
                          key={j.id} 
                          className={`p-2 rounded border transition-all text-[9.5px] ${
                            isCurrent 
                              ? "bg-purple-950/20 border-purple-500/60 shadow-[0_0_8px_rgba(168,85,247,0.1)]" 
                              : "bg-[#161b22]/30 border-[#30363d]/40 hover:bg-[#161b22]/50"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1 pb-1 border-b border-[#30363d]/10">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-xs shrink-0">{classIcon}</span>
                              <div className="truncate min-w-0">
                                <span className="font-extrabold text-[#f1f5f9] text-[10px] block truncate">{j.name}</span>
                                <span className="text-[7.5px] text-slate-500 font-mono italic block leading-none">ID: {j.id}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[7.5px] font-mono text-[#38bdf8] bg-sky-950/20 px-1 py-0.5 rounded border border-sky-500/20 lowercase font-bold">
                                HP:{j.baseStatsIncrements.hpFactor} SP:{j.baseStatsIncrements.spFactor}
                              </span>
                            </div>
                          </div>

                          <p className="text-[9px] text-[#94a3b8] leading-normal my-1">{j.description}</p>

                          {/* Gear allowed and list of skills */}
                          <div className="grid grid-cols-2 gap-1.5 text-[8px] text-slate-400 font-mono py-1 border-t border-[#30363d]/10">
                            <div>
                              <span className="text-slate-500 block text-[7.5px] font-bold">⚔️ WEAPONS:</span>
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {j.allowedWeapons?.map((w, idx) => (
                                  <span key={idx} className="bg-[#161b22] border border-[#30363d] px-1 py-0.3 rounded-sm text-[7.5px] uppercase scale-90 origin-left text-slate-300">{w.replace("_", " ")}</span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[7.5px] font-bold">⚡ ABILITIES:</span>
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {j.skillsAllowed?.map((s, idx) => (
                                  <span key={idx} className="bg-purple-950/40 border border-purple-500/20 px-1 py-0.3 rounded-sm text-[7.5px] text-purple-300 scale-90 origin-left">{s.replace("_", " ")}</span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Promote CTA or lock status */}
                          <div className="pt-1.5 flex justify-between items-center gap-1.5 border-t border-[#30363d]/15 mt-1">
                            <div className="text-[8px] leading-tight text-slate-400 min-w-0">
                              {j.parentJobId ? (
                                <span className="block truncate max-w-[130px]" title={`Requires job ${parentJobName}, Base Lv ${j.requiredBaseLevel}, Job Lv ${j.requiredJobLevel}`}>
                                  Req: <span className="text-purple-300 font-bold">{parentJobName}</span> (B.Lv {j.requiredBaseLevel}/J.Lv {j.requiredJobLevel})
                                </span>
                              ) : (
                                <span className="text-slate-500 block italic">No requirements</span>
                              )}
                            </div>
                            
                            <div className="shrink-0">
                              {isCurrent ? (
                                <span className="text-[8px] text-emerald-400 font-extrabold bg-emerald-950/40 border border-emerald-500/40 px-1.5 py-0.5 rounded-sm uppercase tracking-wider flex items-center gap-0.5">
                                  ● ACTIVE
                                </span>
                              ) : canPromote ? (
                                <button
                                  onClick={() => changeJobClass(j.id)}
                                  className="text-[8.5px] px-2 py-0.5 bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-600 hover:to-purple-700 border border-purple-600 text-purple-100 font-extrabold rounded shadow-sm transition-all uppercase cursor-pointer"
                                >
                                  PROMOTE
                                </button>
                              ) : (
                                <span 
                                  className="text-[8px] leading-none text-slate-500 bg-[#161b22] px-1.5 py-0.5 rounded border border-[#30363d] font-mono flex items-center gap-0.5 cursor-not-allowed uppercase"
                                  title={`Prereq: Must be ${parentJobName}, base Level >= ${j.requiredBaseLevel}, job Level >= ${j.requiredJobLevel}. Toggle BYPASS on header to promote anyway!`}
                                >
                                  LOCKED
                                </span>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Spawn category selector tabs */}
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Entity Inject Tab</label>
                <div className="grid grid-cols-5 gap-0.5 bg-[#161b22] p-0.5 border border-[#30363d]">
                  {(["monster", "npc", "pet", "summon", "stress"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveSpawnType(tab)}
                      className={`text-[8px] py-1 font-semibold uppercase leading-none rounded-sm transition-all ${
                        activeSpawnType === tab
                          ? "bg-[#30363d] text-emerald-400 font-bold"
                          : "text-slate-400 hover:text-white hover:bg-[#161b22]/85"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic injector inputs based on category tab */}
              <div className="bg-[#0d1117] border border-[#30363d] p-2 rounded">
                {activeSpawnType === "monster" && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-400">Spawn real-time Ragnarok monsters anywhere on the grid stage:</p>
                    <div className="flex gap-1 pt-0.5">
                      <button
                        onClick={() => spawnMonster("poring", Math.floor(Math.random() * 20) + 10, Math.floor(Math.random() * 20) + 10)}
                        className="flex-1 text-[9px] bg-pink-600/15 border border-pink-500/35 hover:bg-pink-600/30 py-1 text-pink-400 font-semibold transition-all rounded"
                      >
                        + PORING
                      </button>
                      <button
                        onClick={() => spawnMonster("lunatic", Math.floor(Math.random() * 20) + 10, Math.floor(Math.random() * 20) + 10)}
                        className="flex-1 text-[9px] bg-sky-600/15 border border-sky-500/35 hover:bg-sky-600/30 py-1 text-sky-400 font-semibold transition-all rounded"
                      >
                        + LUNATIC
                      </button>
                      <button
                        onClick={() => spawnMonster("baphomet", Math.floor(Math.random() * 10) + 15, Math.floor(Math.random() * 10) + 15)}
                        className="flex-1 text-[9px] bg-red-600/20 border border-red-500/40 hover:bg-red-600/35 py-1 text-red-300 font-bold transition-all rounded"
                      >
                        👹 BAPHOMET
                      </button>
                    </div>
                  </div>
                )}

                {activeSpawnType === "npc" && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-400">Spawn interactive NPCs on coordinate cells:</p>
                    <div className="flex gap-1 pt-0.5">
                      <button
                        onClick={() => spawnNpc(`kafra_${Math.random().toString(36).substring(5)}`, "Kafra Specialist", "npc_kafra", Math.floor(Math.random() * 10) + 18, Math.floor(Math.random() * 10) + 18)}
                        className="flex-1 text-[9px] bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 py-1 text-blue-300 font-semibold transition-all rounded"
                      >
                        👩 KAFRA CLERK
                      </button>
                      <button
                        onClick={() => spawnNpc(`dealer_${Math.random().toString(36).substring(5)}`, "Tool Dealer", "npc_dealer", Math.floor(Math.random() * 10) + 18, Math.floor(Math.random() * 10) + 18)}
                        className="flex-1 text-[9px] bg-amber-600/15 border border-amber-500/35 hover:bg-amber-600/30 py-1 text-amber-300 font-semibold transition-all rounded"
                      >
                        📦 TOOL DEALER
                      </button>
                    </div>
                  </div>
                )}

                {activeSpawnType === "pet" && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-400">Spawns cute loyal pet companions that can follow players:</p>
                    <div className="flex gap-1 pt-0.5">
                      <button
                        onClick={() => spawnPet("Poporing Master", "poring", Math.floor(Math.random() * 6) + 17, Math.floor(Math.random() * 6) + 17)}
                        className="flex-1 text-[9px] bg-lime-600/15 border border-lime-500/35 hover:bg-lime-600/30 py-1 text-lime-400 font-semibold transition-all rounded"
                      >
                        🟢 PET POPORING
                      </button>
                      <button
                        onClick={() => spawnPet("Chibi Deviruchi", "char_mage", Math.floor(Math.random() * 6) + 17, Math.floor(Math.random() * 6) + 17)}
                        className="flex-1 text-[9px] bg-purple-600/15 border border-purple-500/35 hover:bg-purple-600/30 py-1 text-purple-300 font-semibold transition-all rounded"
                      >
                        👿 PET DEVIRUCHI
                      </button>
                    </div>
                  </div>
                )}

                {activeSpawnType === "summon" && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-400">Summons dynamic elemental helper spirits with timed lifespans:</p>
                    <div className="flex gap-1 pt-0.5">
                      <button
                        onClick={() => spawnSummon("Pyroglyph", "spirit", Math.floor(Math.random() * 6) + 17, Math.floor(Math.random() * 6) + 17)}
                        className="flex-1 text-[9px] bg-orange-600/15 border border-orange-500/35 hover:bg-orange-600/30 py-1 text-orange-400 font-semibold transition-all rounded"
                      >
                        🔥 FIRE SPIRIT
                      </button>
                      <button
                        onClick={() => spawnSummon("Aquamarine", "spirit", Math.floor(Math.random() * 6) + 17, Math.floor(Math.random() * 6) + 17)}
                        className="flex-1 text-[9px] bg-indigo-600/15 border border-indigo-500/35 hover:bg-indigo-600/30 py-1 text-indigo-400 font-semibold transition-all rounded"
                      >
                        ❄️ WATER SPIRIT
                      </button>
                    </div>
                  </div>
                )}

                {activeSpawnType === "stress" && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-400">Stress-test the system with thousands of coordinated entity instances:</p>
                    <div className="flex gap-1 pt-0.5">
                      <button
                        onClick={() => bulkSpawnStressTest(100)}
                        className="flex-1 text-[9px] bg-slate-600/25 border border-slate-500/35 hover:bg-slate-600/40 py-1 text-slate-200 font-medium transition-all rounded"
                      >
                        + 100 ENTITIES
                      </button>
                      <button
                        onClick={() => bulkSpawnStressTest(1000)}
                        className="flex-1 text-[9px] bg-orange-600/20 border border-orange-500/40 hover:bg-orange-600/35 py-1 text-orange-300 font-bold transition-all rounded"
                      >
                        ⚡ 1,000 ENTITIES
                      </button>
                      <button
                        onClick={() => bulkSpawnStressTest(2000)}
                        className="flex-1 text-[9px] bg-red-600/25 border border-red-500/40 hover:bg-red-600/35 py-1 text-red-400 font-extrabold transition-all rounded shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse"
                      >
                        🔥 2,000 STRESS
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Reactive Real-Time Data State Inspector */}
          <div className="p-3 bg-[#0d1117] h-48 overflow-hidden flex flex-col">
            <div className="text-[9px] font-bold text-emerald-400 mb-1 border-b border-[#30363d] pb-1 uppercase tracking-wider flex justify-between items-center">
              <span>REAL_TIME_INSPECTOR_SERVICE</span>
              <span className="text-amber-500 animate-pulse font-mono block">
                SPATIAL_HASH Q: {benchElapsedMs.toFixed(3)}ms [{benchMatches} match]
              </span>
            </div>
            <div className="flex-1 overflow-auto text-emerald-400 select-text bg-[#0c0d10] p-2 border border-[#30363d]/50 rounded text-[9.5px] leading-relaxed">
              <pre>
                {JSON.stringify({
                  watch_schema: "player_schema.json",
                  entity: player?.components.identity?.name || "Player_01",
                  components: {
                    Stats: {
                      str: stats?.str || 9,
                      agi: stats?.agi || 9,
                      vit: stats?.vit || 9,
                      int: stats?.int || 9,
                      dex: stats?.dex || 9,
                      luk: stats?.luk || 9
                    },
                    Equipment: {
                      weapon: equipment?.weapon || "unarmed",
                      shield: equipment?.shield || "none"
                    },
                    Job: {
                      base: activeJobDesc?.name || "Novice",
                      level: job?.baseLevel || 1,
                      jobLevel: job?.jobLevel || 1
                    }
                  },
                  is_game_tick_active: true,
                  dirty: false
                }, null, 2)}
              </pre>
            </div>
          </div>

        </div>

      </div>

      {/* Console log footer across absolute bottom of workspace (Matches High Density layout) */}
      <div className="h-36 bg-[#0d1117] border-t border-[#30363d] flex flex-col shrink-0 overflow-hidden">
        <div className="flex bg-[#161b22] px-4 py-1.5 border-b border-[#30363d] text-[9px] gap-6 shrink-0 text-slate-500">
          <span className="text-[#38bdf8] font-bold">DEBUG_CONSOLE</span>
          <span className="hover:text-slate-200 cursor-pointer">NETWORK_REPLICATION</span>
          <span className="hover:text-slate-200 cursor-pointer">ECS_SYSTEMS_MONITOR</span>
          <span className="hover:text-slate-200 cursor-pointer">MEMORY_PROFILER_0x1A</span>
        </div>
        
        <div className="flex-1 p-3 text-[11px] overflow-y-auto space-y-1 text-slate-300 font-mono select-text">
          {logs.length === 0 ? (
            <div className="flex gap-4">
              <span className="text-slate-500">[{mounted ? new Date().toTimeString().split(" ")[0] : "12:00:00"}]</span>
              <span className="text-blue-400">[NETWORK]</span> Synced handshake successful. Player ID: player_hero. Ready for inputs.
            </div>
          ) : (
            logs.map((log) => {
              let colorClass = "text-slate-400";
              if (log.type === "system") colorClass = "text-yellow-400";
              if (log.type === "battle") colorClass = "text-rose-400";
              if (log.type === "chat") colorClass = "text-purple-400";

              return (
                <div key={log.id} className="flex gap-4 items-baseline">
                  <span className="text-slate-500 bg-[#161b22]/40 px-1 py-0.5 rounded text-[9.5px]">[{log.timestamp}]</span>
                  <span>
                    <span className={`${colorClass} font-bold mr-1.5`}>[{log.type.toUpperCase()}]</span>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
