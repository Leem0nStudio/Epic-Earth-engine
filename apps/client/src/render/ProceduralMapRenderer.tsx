import { useEffect } from "react";
import * as THREE from "three";
import { useGameStore } from "../core/store";
import { getHeightAt } from "@epic-earth/shared";
import type { MapInstance } from "../world/types";
import { CellType } from "../world/types";

const WATER_COLOR = new THREE.Color("#1e3a5f");
const SAND_COLOR = new THREE.Color("#d4a373");
const GRASS_LOW = new THREE.Color("#4ade80");
const GRASS_HIGH = new THREE.Color("#22c55e");
const ROCK_COLOR = new THREE.Color("#6b7280");
const SNOW_COLOR = new THREE.Color("#f8fafc");

function getTerrainColor(h: number): THREE.Color {
  if (h < -0.2) return WATER_COLOR;
  if (h < -0.1) return SAND_COLOR;
  if (h < 0.15) return new THREE.Color().lerpColors(GRASS_LOW, GRASS_HIGH, (h + 0.1) / 0.25);
  if (h < 0.35) return new THREE.Color().lerpColors(GRASS_HIGH, ROCK_COLOR, (h - 0.15) / 0.2);
  if (h < 0.6) return new THREE.Color().lerpColors(ROCK_COLOR, SNOW_COLOR, (h - 0.35) / 0.25);
  return SNOW_COLOR;
}

export function generateProceduralTerrainGeometry(map: MapInstance): THREE.BufferGeometry {
  const seed = map.seed!;
  const tileSize = map.tileSize || 2;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const halfW = (map.width * tileSize) / 2;
  const halfH = (map.height * tileSize) / 2;

  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const cell = map.cells[row]?.[col];
      if (!cell || cell.type === CellType.Blocked) continue;

      const baseIdx = positions.length / 3;
      const wx = col * tileSize - halfW;
      const wz = row * tileSize - halfH;

      const h00 = getHeightAt(col, row, seed);
      const h10 = getHeightAt(col + 1, row, seed);
      const h11 = getHeightAt(col + 1, row + 1, seed);
      const h01 = getHeightAt(col, row + 1, seed);

      for (const [px, py, pz] of [[wx, h00, wz], [wx + tileSize, h10, wz], [wx + tileSize, h11, wz + tileSize], [wx, h01, wz + tileSize]] as [number, number, number][]) {
        positions.push(px, py, pz);
        const color = getTerrainColor(py);
        colors.push(color.r, color.g, color.b);
      }

      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
      indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function simpleHash(s: number): number {
  const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function generateVegetationPositions(map: MapInstance): { positions: THREE.Vector3[]; type: "tree" | "rock" }[] {
  const seed = map.seed!;
  const tileSize = map.tileSize || 2;
  const halfW = (map.width * tileSize) / 2;
  const halfH = (map.height * tileSize) / 2;

  const trees: THREE.Vector3[] = [];
  const rocks: THREE.Vector3[] = [];

  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const cell = map.cells[row]?.[col];
      if (!cell || cell.type !== CellType.Walkable) continue;

      const h = getHeightAt(col, row, seed);
      if (h < -0.1 || h > 0.4) continue;

      const r = simpleHash((row * map.width + col) * 1.001);
      const r2 = simpleHash((row * map.width + col) * 2.002);
      const wx = col * tileSize - halfW + r * tileSize;
      const wz = row * tileSize - halfH + r2 * tileSize;

      if (r < 0.12) {
        trees.push(new THREE.Vector3(wx, h, wz));
      } else if (r < 0.18) {
        rocks.push(new THREE.Vector3(wx, h, wz));
      }
    }
  }

  const result: { positions: THREE.Vector3[]; type: "tree" | "rock" }[] = [];
  if (trees.length > 0) result.push({ positions: trees, type: "tree" });
  if (rocks.length > 0) result.push({ positions: rocks, type: "rock" });
  return result;
}

function buildInstanced(type: "tree" | "rock", positions: THREE.Vector3[]): THREE.InstancedMesh | null {
  if (positions.length === 0) return null;

  const geo = type === "rock"
    ? new THREE.DodecahedronGeometry(0.2)
    : new THREE.ConeGeometry(0.4, 0.7, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: type === "rock" ? "#6b7280" : "#166534",
    roughness: 0.9,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < positions.length; i++) {
    dummy.position.copy(positions[i]);
    const s = 0.6 + Math.random() * 0.8;
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  return mesh;
}

export default function ProceduralMapRenderer({
  tileGroupRef,
  vegGroupRef,
}: {
  tileGroupRef: React.RefObject<THREE.Group | null>;
  vegGroupRef: React.RefObject<THREE.Group | null>;
}) {
  const currentMap = useGameStore((s) => s.currentMap);

  useEffect(() => {
    if (!currentMap.seed) return;
    const group = tileGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        (child.material as THREE.Material)?.dispose();
      }
      group.remove(child);
    }

    const geo = generateProceduralTerrainGeometry(currentMap);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }, [currentMap, tileGroupRef]);

  useEffect(() => {
    if (!currentMap.seed) return;
    const group = vegGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.InstancedMesh;
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose();
      group.remove(child);
    }

    const vegGroups = generateVegetationPositions(currentMap);
    for (const vg of vegGroups) {
      const inst = buildInstanced(vg.type, vg.positions);
      if (inst) group.add(inst);
    }
  }, [currentMap, vegGroupRef]);

  return null;
}
