"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "../../shared/core/store";
import { CellType } from "../../shared/world/types";

// A component to tick the GameClock or bind animations
function GameLoopTicker() {
  useFrame((state, delta) => {
    // Deliberate delta tick driven inside store instead of duplication
  });
  return null;
}

function SceneContent() {
  const currentMap = useGameStore((state) => state.currentMap);
  const ecsWorld = useGameStore((state) => state.ecsWorld);
  const movePlayerTo = useGameStore((state) => state.movePlayerTo);
  const selectedEntityId = useGameStore((state) => state.selectedEntityId);
  const playerEntityId = useGameStore((state) => state.playerEntityId);
  const selectEntity = useGameStore((state) => state.selectEntity);
  const gameTickCount = useGameStore((state) => state.gameTickCount); // triggers re-render on ticks
  const groundItems = useGameStore((state) => state.groundItems || []);
  const pickUpGroundItem = useGameStore((state) => state.pickUpGroundItem);
  const itemsCatalog = useGameStore((state) => state.itemsCatalog || []);

  // Extract all entities currently active
  const entities = ecsWorld.queryEntities(["position", "identity"]);

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.8} castShadow />
      <pointLight position={[0, 10, 0]} intensity={1.0} />

      {/* Grid Floor Map Renderer (Translates 2D map index to 3D planes) */}
      <group position={[-currentMap.width / 2, 0, -currentMap.height / 2]}>
        {currentMap.cells.map((row, y) =>
          row.map((cell, x) => {
            let color = "#e5e7eb"; // Walkable cell
            if (cell.type === CellType.Blocked) {
              color = "#fca5a5"; // Blocked (reddish)
            } else if (cell.type === CellType.Water) {
              color = "#60a5fa"; // Water (blue)
            }

            // Create some visual height for pillars matching RO dungeons
            const isPillar = cell.type === CellType.Blocked && x % 10 === 0 && y % 10 === 0;

            return (
              <group 
                key={`${x}-${y}`} 
                position={[x + 0.5, cell.z, y + 0.5]}
                onClick={(e) => {
                  e.stopPropagation();
                  movePlayerTo(x, y);
                }}
              >
                {isPillar ? (
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[0.8, 3.0, 0.8]} />
                    <meshStandardMaterial color="#6b7280" roughness={0.8} />
                  </mesh>
                ) : (
                  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <planeGeometry args={[0.95, 0.95]} />
                    <meshStandardMaterial
                      color={color}
                      roughness={0.9}
                      metalness={0.1}
                    />
                  </mesh>
                )}
              </group>
            );
          })
        )}

        {/* Entities Rendering with 2D/3D RO Hybrid Billboards */}
        {entities.map((entity) => {
          const pos = entity.components.position!;
          const ident = entity.components.identity!;
          const render = entity.components.render;
          const stats = entity.components.stats;

          if (!pos) return null;

          const isPlayer = ident.type === "player";
          const isSelected = selectedEntityId === ident.id;

          // Determine avatar color
          let avatarColor = "#3b82f6"; // player blue
          if (ident.type === "monster") {
            avatarColor = ident.id.includes("baphomet") ? "#991b1b" : "#dc2626"; // red monster
          } else if (ident.type === "npc") {
            avatarColor = "#10b981"; // NPC green
          } else if (ident.type === "pet") {
            avatarColor = "#f43f5e"; // cute pet wild rose pink
          } else if (ident.type === "summon") {
            avatarColor = "#8b5cf6"; // helper spirit magical indigo
          }

          return (
            <group
              key={ident.id}
              position={[pos.x + 0.5, pos.z + 0.2, pos.y + 0.5]}
              onClick={(e) => {
                e.stopPropagation();
                selectEntity(ident.id);
              }}
            >
              {/* Target Selection Indicator (Floor plane overlay) */}
              {isSelected && (
                <mesh position={[0, -0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.6, 0.7, 32]} />
                  <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
                </mesh>
              )}

              {/* RO style 2D-Looking Billboard Sprite Representation */}
              <Billboard position={[0, 0.8, 0]}>
                {/* 3D mesh capsule placeholder inside the dynamic billboard */}
                <mesh castShadow>
                  <cylinderGeometry args={[0.25 * (render?.scale || 1.0), 0.25 * (render?.scale || 1.0), 1.2 * (render?.scale || 1.0), 16]} />
                  <meshStandardMaterial
                    color={avatarColor}
                    roughness={0.4}
                    opacity={render?.currentAnimation === "hit" ? 0.6 : 1.0}
                    transparent
                  />
                </mesh>

                {/* Overhead visual badges (HP, name & details) */}
                <Html position={[0, 1.2 * (render?.scale || 1.0), 0]} center distanceFactor={12}>
                  <div className="flex flex-col items-center pointer-events-none select-none text-center">
                    {/* Name tag with level badge */}
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.5 rounded shadow-md border whitespace-nowrap ${
                        isPlayer
                          ? "bg-blue-600 text-white border-blue-400"
                          : ident.type === "monster"
                          ? "bg-red-800 text-red-100 border-red-600"
                          : ident.type === "npc"
                          ? "bg-emerald-700 text-white border-emerald-500"
                          : ident.type === "pet"
                          ? "bg-[#be185d] text-pink-500 border-pink-400"
                          : "bg-[#5b21b6] text-purple-200 border-purple-400"
                      }`}
                    >
                      {ident.name}
                      {entity.components.job?.baseLevel && ` (Lvl ${entity.components.job.baseLevel})`}
                    </span>

                    {/* Compact HP Bar for monsters/players */}
                    {stats && (
                      <div className="w-16 h-1.5 bg-gray-900 border border-gray-700 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-100 ${
                            isPlayer ? "bg-emerald-500" : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.max(0, Math.min(100, (stats.currentHp / stats.maxHp) * 100))}%`,
                          }}
                        />
                      </div>
                    )}

                    {/* Animation indicator text */}
                    {render && render.currentAnimation !== "idle" && (
                      <span className="text-[9px] bg-black/60 text-yellow-300 font-mono px-1 rounded-sm mt-0.5">
                        {render.currentAnimation.toUpperCase()}
                      </span>
                    )}
                  </div>
                </Html>
              </Billboard>
            </group>
          );
        })}

        {/* Map Portals Visual Representation */}
        {currentMap.portals.map((portal) => (
          <group key={portal.id} position={[portal.x + 0.5, -0.1, portal.y + 0.5]}>
            {/* Blue glowing portal zone on ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.0, 0.9, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
            <Html position={[0, 0.5, 0]} center distanceFactor={12}>
              <div className="bg-sky-900/90 text-sky-200 border border-sky-600 px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider font-semibold">
                Portal
              </div>
            </Html>
          </group>
        ))}

        {/* Map Regions Visual Representation dynamically loaded from JSONs */}
        {currentMap.regions?.map((region) => {
          const rw = region.maxX - region.minX + 1;
          const rh = region.maxY - region.minY + 1;
          const rx = region.minX + rw / 2;
          const ry = region.minY + rh / 2;

          return (
            <group key={region.id} position={[rx, -0.15, ry]}>
              {/* Floor Highlight panel */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[rw, rh]} />
                <meshBasicMaterial color={region.color} transparent opacity={0.08} depthWrite={false} />
              </mesh>
              {/* Border floor outlines */}
              <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[rw, rh]} />
                <meshBasicMaterial color={region.color} wireframe transparent opacity={0.25} />
              </mesh>
              {/* HTML Overlay with name badge */}
              <Html position={[0, 0.1, 0]} center distanceFactor={15}>
                <div 
                  className="px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase border select-none pointer-events-none shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
                  style={{
                    backgroundColor: "#0d1117ee",
                    borderColor: region.color,
                    color: region.color,
                  }}
                >
                  📍 {region.name}
                </div>
              </Html>
            </group>
          );
        })}

        {/* Ground Items Floating Billboards */}
        {groundItems.map((g) => {
          const itemDef = itemsCatalog.find((i) => i.id === g.itemId);
          if (!itemDef) return null;

          let groundEmoji = "📦";
          if (itemDef.type === "usable") groundEmoji = "🧪";
          else if (itemDef.type === "weapon") groundEmoji = "⚔️";
          else if (itemDef.type === "shield" || itemDef.type === "headgear_upper") groundEmoji = "🛡️";
          else if (itemDef.type === "quest") groundEmoji = "🔱";

          return (
            <group
              key={g.id}
              position={[g.x + 0.5, 0.1, g.y + 0.5]}
              onClick={(e) => {
                e.stopPropagation();
                if (pickUpGroundItem) pickUpGroundItem(g.id);
              }}
            >
              {/* Ground visual shadow ring */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[0.3, 0.4, 16]} />
                <meshBasicMaterial color="#fbbf24" opacity={0.6} transparent />
              </mesh>
              
              <Billboard position={[0, 0.35, 0]}>
                <Html center distanceFactor={12}>
                  <div className="flex flex-col items-center bg-[#131722]/95 border border-[#fcb53b]/80 text-[#f1f5f9] px-2 py-1 rounded text-[8px] font-mono select-none pointer-events-auto cursor-pointer shadow-md transform hover:scale-110 active:scale-95 transition-all whitespace-nowrap">
                    <span className="text-sm scale-110 animate-bounce leading-none">{groundEmoji}</span>
                    <span className="font-extrabold text-[8px] tracking-tight">{itemDef.name} {g.quantity > 1 ? `x${g.quantity}` : ""}</span>
                    <span className="text-[6px] text-amber-500 font-bold uppercase">(click to loot)</span>
                  </div>
                </Html>
              </Billboard>
            </group>
          );
        })}
      </group>

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.2} // Prevent camera going underground
        minDistance={5}
        maxDistance={40}
      />
    </>
  );
}

export default function ThreeCanvas() {
  return (
    <div className="w-full h-full relative bg-slate-900" id="three-dimension-stage">
      <Canvas
        camera={{ position: [0, 16, 14], fov: 45 }}
        shadows
        gl={{ antialias: true }}
      >
        <SceneContent />
        <GameLoopTicker />
      </Canvas>
    </div>
  );
}
