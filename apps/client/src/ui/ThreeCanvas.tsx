"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "../core/store";
import { CellType } from "../world/types";

interface EntityMesh {
  group: THREE.Group;
  cylinder: THREE.Mesh;
  selectionRing?: THREE.Mesh;
  hpBar?: THREE.Mesh;
  hpBarBg?: THREE.Mesh;
  label?: THREE.Sprite;
  isPlayer: boolean;
  lastHpPct: number;
}

const ENTITY_COLORS: Record<string, string> = {
  player: "#3b82f6",
  monster: "#dc2626",
  npc: "#10b981",
  pet: "#f43f5e",
  summon: "#8b5cf6",
};

function createLabelSprite(name: string, type: string, baseLevel?: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  const bgColors: Record<string, string> = {
    player: "#1d4ed8",
    monster: "#7f1d1d",
    npc: "#047857",
    pet: "#9d174d",
    summon: "#5b21b6",
  };
  const borderColors: Record<string, string> = {
    player: "#60a5fa",
    monster: "#dc2626",
    npc: "#34d399",
    pet: "#f43f5e",
    summon: "#a78bfa",
  };

  const bg = bgColors[type] || "#1d4ed8";
  const border = borderColors[type] || "#60a5fa";
  const levelStr = baseLevel != null ? ` (Lvl ${baseLevel})` : "";

  ctx.clearRect(0, 0, 512, 128);
  // Background pill
  const text = `${name}${levelStr}`;
  ctx.font = "bold 42px monospace";
  const metrics = ctx.measureText(text);
  const pw = metrics.width + 32;
  const ph = 56;
  const px = (512 - pw) / 2;
  const py = (128 - ph) / 2;
  const radius = ph / 2;

  ctx.beginPath();
  ctx.moveTo(px + radius, py);
  ctx.lineTo(px + pw - radius, py);
  ctx.quadraticCurveTo(px + pw, py, px + pw, py + radius);
  ctx.lineTo(px + pw, py + ph - radius);
  ctx.quadraticCurveTo(px + pw, py + ph, px + pw - radius, py + ph);
  ctx.lineTo(px + radius, py + ph);
  ctx.quadraticCurveTo(px, py + ph, px, py + ph - radius);
  ctx.lineTo(px, py + radius);
  ctx.quadraticCurveTo(px, py, px + radius, py);
  ctx.closePath();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 128 / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1);
  sprite.position.y = 1.6;
  return sprite;
}

function createEntityMesh(ident: { id: string; name: string; type: string }, job?: { baseLevel?: number }, renderScale: number = 1): EntityMesh {
  const group = new THREE.Group();
  const color = ENTITY_COLORS[ident.type] || "#3b82f6";

  group.userData.entityId = ident.id;
  const cylGeo = new THREE.CylinderGeometry(0.25 * renderScale, 0.25 * renderScale, 1.2 * renderScale, 16);
  const cylMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const cylinder = new THREE.Mesh(cylGeo, cylMat);
  cylinder.castShadow = true;
  cylinder.position.y = 0.6 * renderScale;
  cylinder.userData.entityId = ident.id;
  group.add(cylinder);

  // HP bar background
  const barWidth = 0.6;
  const barHpGeo = new THREE.PlaneGeometry(barWidth, 0.06);
  const hpBarBg = new THREE.Mesh(barHpGeo, new THREE.MeshBasicMaterial({ color: "#333333", depthTest: false }));
  hpBarBg.position.y = 1.3 * renderScale;
  group.add(hpBarBg);

  // HP bar fill
  const hpBarMat = new THREE.MeshBasicMaterial({ color: ident.type === "player" ? "#10b981" : "#ef4444", depthTest: false });
  const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.06), hpBarMat);
  hpBar.position.y = 1.3 * renderScale;
  hpBar.position.z = 0.001;
  group.add(hpBar);

  // Name label
  const label = createLabelSprite(ident.name, ident.type, job?.baseLevel);
  group.add(label);

  return { group, cylinder, hpBar, hpBarBg, label, isPlayer: ident.type === "player", lastHpPct: 1 };
}

function disposeEntityMesh(em: EntityMesh) {
  em.group.parent?.remove(em.group);
  em.cylinder.geometry.dispose();
  (em.cylinder.material as THREE.Material).dispose();
  if (em.hpBar) { em.hpBar.geometry.dispose(); (em.hpBar.material as THREE.Material).dispose(); }
  if (em.hpBarBg) { em.hpBarBg.geometry.dispose(); (em.hpBarBg.material as THREE.Material).dispose(); }
  if (em.selectionRing) { em.selectionRing.geometry.dispose(); (em.selectionRing.material as THREE.Material).dispose(); }
  if (em.label) {
    const mat = em.label.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.dispose();
  }
}

function ClickHandler({ entityGroupRef, tileGroupRef }: { entityGroupRef: React.RefObject<THREE.Group | null>; tileGroupRef: React.RefObject<THREE.Group | null> }) {
  const { gl, camera } = useThree();
  const selectEntity = useGameStore((s) => s.selectEntity);
  const movePlayerTo = useGameStore((s) => s.movePlayerTo);
  const attackEntity = useGameStore((s) => s.attackEntity);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Check entities first
      const entityGroup = entityGroupRef.current;
      if (entityGroup) {
        const hits = raycaster.intersectObjects(entityGroup.children, true);
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && !obj.userData.entityId) obj = obj.parent;
          if (obj && obj.userData.entityId) {
            const clickedId = obj.userData.entityId;
            selectEntity(clickedId);
            // Attack monsters on click
            const ecs = useGameStore.getState().ecsWorld;
            const ent = ecs.getEntity(clickedId);
            if (ent && ent.components.identity?.type === "monster") {
              attackEntity(clickedId);
            }
            return;
          }
        }
      }

      // Fall back to map tiles
      const tileGroup = tileGroupRef.current;
      if (tileGroup) {
        const hits = raycaster.intersectObjects(tileGroup.children, true);
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && !obj.userData.clickPos) obj = obj.parent;
          if (obj && obj.userData.clickPos) {
            movePlayerTo(obj.userData.clickPos.x, obj.userData.clickPos.y);
          }
        }
      }
    };
    gl.domElement.addEventListener("click", handler);
    return () => gl.domElement.removeEventListener("click", handler);
  }, [gl, camera, selectEntity, movePlayerTo, attackEntity, entityGroupRef, tileGroupRef]);

  return null;
}

function MapTiles({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const currentMap = useGameStore((s) => s.currentMap);

  const meshes = useMemo(() => {
    const result: { x: number; y: number; z: number; color: string; isPillar: boolean }[] = [];
    for (let y = 0; y < currentMap.height; y++) {
      for (let x = 0; x < currentMap.width; x++) {
        const cell = currentMap.cells[y]?.[x];
        if (!cell) continue;
        let color = "#e5e7eb";
        if (cell.type === CellType.Blocked) color = "#fca5a5";
        else if (cell.type === CellType.Water) color = "#60a5fa";
        const isPillar = cell.type === CellType.Blocked && x % 10 === 0 && y % 10 === 0;
        result.push({ x: x + 0.5, y: y + 0.5, z: cell.z, color, isPillar });
      }
    }
    return result;
  }, [currentMap]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    // Clear previous tiles
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    for (const tile of meshes) {
      const g = new THREE.Group();
      g.position.set(tile.x, tile.z, tile.y);
      if (tile.isPillar) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 3.0, 0.8),
          new THREE.MeshStandardMaterial({ color: "#6b7280", roughness: 0.8 })
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
      } else {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.95, 0.95),
          new THREE.MeshStandardMaterial({ color: tile.color, roughness: 0.9, metalness: 0.1 })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        g.add(mesh);
      }
      g.userData.clickPos = { x: tile.x - 0.5, y: tile.y - 0.5 };
      group.add(g);
    }
  }, [meshes, groupRef]);

  return <group ref={groupRef} position={[-currentMap.width / 2, 0, -currentMap.height / 2]} />;
}

function EntityLayer({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const meshPool = useRef<Map<string, EntityMesh>>(new Map());

  useFrame(() => {
    const state = useGameStore.getState();
    const entities = state.ecsWorld.queryEntities(["position", "identity"]);

    const group = groupRef.current;
    if (!group) return;

    const currentIds = new Set<string>();
    const currentSelectedId = state.selectedEntityId;

    for (const entity of entities) {
      const pos = entity.components.position!;
      const ident = entity.components.identity!;
      currentIds.add(ident.id);

      let em = meshPool.current.get(ident.id);
      if (!em) {
        const job = entity.components.job;
        const render = entity.components.render;
        em = createEntityMesh(ident, job, render?.scale || 1);
        meshPool.current.set(ident.id, em);
        group.add(em.group);
      }

      // Update position every frame
      em.group.position.set(pos.x + 0.5, pos.z + 0.2, pos.y + 0.5);

      // Update selection ring
      const isSelected = currentSelectedId === ident.id;
      if (isSelected && !em.selectionRing) {
        const ringGeo = new THREE.RingGeometry(0.6, 0.7, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: "#ef4444", side: THREE.DoubleSide, depthTest: false });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.19;
        em.selectionRing = ring;
        em.group.add(ring);
      } else if (!isSelected && em.selectionRing) {
        em.group.remove(em.selectionRing);
        em.selectionRing.geometry.dispose();
        (em.selectionRing.material as THREE.Material).dispose();
        em.selectionRing = undefined;
      }

      // Update HP bar
      const stats = entity.components.stats;
      if (stats && em.hpBar && em.hpBarBg) {
        const hpPct = Math.max(0, Math.min(1, stats.currentHp / stats.maxHp));
        if (Math.abs(hpPct - em.lastHpPct) > 0.01) {
          em.lastHpPct = hpPct;
          const barWidth = 0.6;
          em.hpBar.scale.x = hpPct;
          em.hpBar.position.x = -(barWidth / 2) * (1 - hpPct);
        }
      }

      // Update animation opacity
      const render = entity.components.render;
      if (render && em.cylinder) {
        const mat = em.cylinder.material as THREE.MeshStandardMaterial;
        const targetOpacity = render.currentAnimation === "hit" ? 0.6 : 1.0;
        if (Math.abs(mat.opacity - targetOpacity) > 0.01) {
          mat.opacity = targetOpacity;
          mat.transparent = targetOpacity < 1;
          mat.needsUpdate = true;
        }
      }
    }

    // Remove stale entities
    for (const [id, em] of meshPool.current) {
      if (!currentIds.has(id)) {
        disposeEntityMesh(em);
        meshPool.current.delete(id);
      }
    }
  });

  return <group ref={groupRef} />;
}

function MapDecorations() {
  const currentMap = useGameStore((s) => s.currentMap);

  const portals = useMemo(() => currentMap.portals || [], [currentMap]);
  const regions = useMemo(() => currentMap.regions || [], [currentMap]);

  return (
    <group position={[-currentMap.width / 2, 0, -currentMap.height / 2]}>
      {portals.map((portal) => {
        const px = portal.x + 0.5;
        const py = portal.y + 0.5;
        return (
          <group key={portal.id} position={[px, -0.1, py]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.0, 0.9, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {regions.map((region) => {
        const rw = region.maxX - region.minX + 1;
        const rh = region.maxY - region.minY + 1;
        const rx = region.minX + rw / 2;
        const ry = region.minY + rh / 2;
        return (
          <group key={region.id} position={[rx, -0.15, ry]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[rw, rh]} />
              <meshBasicMaterial color={region.color} transparent opacity={0.08} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[rw, rh]} />
              <meshBasicMaterial color={region.color} wireframe transparent opacity={0.25} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function GroundItemsLayer() {
  const groundItems = useGameStore((s) => s.groundItems || []);
  const itemsCatalog = useGameStore((s) => s.itemsCatalog || []);
  const pickUpGroundItem = useGameStore((s) => s.pickUpGroundItem);
  const currentMap = useGameStore((s) => s.currentMap);

  const itemDefs = useMemo(() => {
    return groundItems.map((g) => {
      const def = itemsCatalog.find((i) => i.id === g.itemId);
      if (!def) return null;
      return { ...g, def };
    }).filter(Boolean);
  }, [groundItems, itemsCatalog]);

  const meshes = useMemo(() => {
    const pool: THREE.Mesh[] = [];
    for (const item of itemDefs) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.4, 16),
        new THREE.MeshBasicMaterial({ color: "#fbbf24", opacity: 0.6, transparent: true })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(item!.x + 0.5, 0.01, item!.y + 0.5);
      pool.push(ring);
    }
    return pool;
  }, [itemDefs]);

  return (
    <group position={[-currentMap.width / 2, 0, -currentMap.height / 2]}>
      {meshes.map((mesh, i) => (
        <primitive key={itemDefs[i]?.id || i} object={mesh} />
      ))}
    </group>
  );
}

function SceneContent() {
  const tileGroupRef = useRef<THREE.Group>(null);
  const entityGroupRef = useRef<THREE.Group>(null);

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.8} castShadow />
      <pointLight position={[0, 10, 0]} intensity={1.0} />

      <MapTiles groupRef={tileGroupRef} />
      <EntityLayer groupRef={entityGroupRef} />
      <ClickHandler entityGroupRef={entityGroupRef} tileGroupRef={tileGroupRef} />
      <MapDecorations />
      <GroundItemsLayer />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.2}
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
      </Canvas>
    </div>
  );
}
