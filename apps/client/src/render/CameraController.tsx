import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "../core/store";

export default function CameraController({
  followEnabled = true,
  isometric = true,
  minDistance = 8,
  maxDistance = 35,
}: {
  followEnabled?: boolean;
  isometric?: boolean;
  minDistance?: number;
  maxDistance?: number;
}) {
  const controlsRef = useRef<any>(null!);
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());

  // Set initial isometric angle
  useEffect(() => {
    if (isometric) {
      // Classic RO-style isometric angle: ~30° elevation, 45° azimuth
      camera.position.set(12, 16, 12);
      camera.lookAt(0, 0, 0);
    }
  }, [camera, isometric]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Follow the player entity
    if (followEnabled) {
      const state = useGameStore.getState();
      const player = state.ecsWorld.getEntity(state.playerEntityId);
      if (player?.components.position) {
        const pos = player.components.position;
        // Convert grid position to world space (same convention as MapTiles)
        const map = state.currentMap;
        if (map.seed) {
          const tileSize = map.tileSize || 2;
          const halfW = (map.width * tileSize) / 2;
          const halfH = (map.height * tileSize) / 2;
          targetPos.current.set(
            pos.x * tileSize + tileSize / 2 - halfW,
            0,
            pos.y * tileSize + tileSize / 2 - halfH
          );
        } else {
          targetPos.current.set(
            pos.x + 0.5 - map.width / 2,
            0,
            pos.y + 0.5 - map.height / 2
          );
        }
        controls.target.lerp(targetPos.current, 0.05);
      }
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      maxPolarAngle={isometric ? Math.PI / 2.7 : Math.PI / 2.2}
      minPolarAngle={isometric ? Math.PI / 4 : 0}
      minDistance={minDistance}
      maxDistance={maxDistance}
    />
  );
}
