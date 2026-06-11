"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { WebSocketChannel } from "../network/WebSocketChannel";
import { setChannel } from "../network";
import { useGameStore } from "../core/store";
import type {
  CharacterEntry, ZCEnterWorldPayload, EntitySnapshot,
  ZCEntityDamagePayload, ZCEntityDeathPayload, ZCEntityUpdatePayload,
  ZCMapLoadPayload, ZCMapChangePayload, ZCHpSpUpdatePayload, ZCExpUpdatePayload,
  ZCLevelUpPayload, ZCInventoryUpdatePayload, ZCSkillCastPayload, ZCChatMessagePayload,
  ZCStatUpdatePayload,
} from "@epic-earth/shared";
import { worldRuntime } from "../world/WorldLoader";
import LoginScreen from "./auth/LoginScreen";
import CharacterSelectScreen from "./auth/CharacterSelectScreen";
import EnteringScreen from "./auth/EnteringScreen";
import ReconnectingScreen from "./auth/ReconnectingScreen";

type AuthPhase = "login" | "characters" | "entering" | "ingame" | "reconnecting";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [channel, setLocalChannel] = useState<WebSocketChannel | null>(null);
  const [charError, setCharError] = useState<string | null>(null);
  const [newCharName, setNewCharName] = useState("");
  const newCharJob = "novice";
  const lastCharacterId = React.useRef<string | null>(null);

  const handleEntitySpawn = useCallback((entity: EntitySnapshot) => {
    const store = useGameStore.getState();
    if (entity.type === "player" && entity.id !== store.playerEntityId) {
      store.spawnNpc(entity.id, entity.name, entity.spriteSheetId, entity.position.x, entity.position.y);
    } else if (entity.type === "monster") {
      store.spawnMonsterFromSnapshot(entity);
    }
  }, []);

  const handleEntityDespawn = useCallback((entityId: string) => {
    const ecs = useGameStore.getState().ecsWorld;
    const entity = ecs.getEntity(entityId);
    if (entity) {
      ecs.removeEntity(entityId);
      useGameStore.getState().entityManager.despawn(entityId);
    }
  }, []);

  const handleEntityMove = useCallback((entityId: string, x: number, y: number, _z: number) => {
    const ecs = useGameStore.getState().ecsWorld;
    const entity = ecs.getEntity(entityId);
    if (!entity || !entity.components.position) return;
    entity.components.position.targetX = x;
    entity.components.position.targetY = y;
    if (entity.components.position.path) {
      entity.components.position.path = [];
    }
    if (entity.components.render) {
      entity.components.render.currentAnimation = "walk";
    }
  }, []);

  const onLogin = useCallback(async () => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return;
    }
    const token = data.session?.access_token;
    if (!token) return;

    const ws = new WebSocketChannel(WS_URL, {
      onAuthOk: (_accountId, chars) => {
        setCharacters(chars);
        if (lastCharacterId.current) {
          channel?.selectCharacter(lastCharacterId.current);
          setPhase("entering");
        } else {
          setPhase("characters");
        }
      },
      onAuthError: (err) => {
        setAuthError(err);
        setPhase("login");
      },
      onCharacterList: (chars) => setCharacters(chars),
      onCharacterCreated: (char) => {
        setCharacters((prev) => [...prev, char]);
        setNewCharName("");
        setCharError(null);
      },
      onEnterWorld: (payload: ZCEnterWorldPayload) => {
        useGameStore.getState().setServerEnterWorld(payload);
        setPhase("ingame");
      },
      onEntitySpawn: handleEntitySpawn,
      onEntityDespawn: handleEntityDespawn,
      onEntityMove: handleEntityMove,
      onEntityAttack: () => {},
      onEntityDamage: (payload: ZCEntityDamagePayload) => {
        const ecs = useGameStore.getState().ecsWorld;
        const target = ecs.getEntity(payload.targetId);
        if (target?.components.stats) {
          target.components.stats.currentHp = Math.max(0, target.components.stats.currentHp - payload.damage);
        }
      },
      onEntityDeath: (payload: ZCEntityDeathPayload) => {
        const store = useGameStore.getState();
        if (payload.entityId === store.playerEntityId) {
          const player = store.ecsWorld.getEntity(payload.entityId);
          if (player?.components.stats) {
            player.components.stats.currentHp = 0;
          }
          store.addLog("You have been defeated!", "battle");
        } else {
          store.ecsWorld.removeEntity(payload.entityId);
          store.entityManager.despawn(payload.entityId);
          store.addLog(`Entity ${payload.entityId} has been defeated.`, "battle");
        }
      },
      onEntityUpdate: (payload: ZCEntityUpdatePayload) => {
        const ecs = useGameStore.getState().ecsWorld;
        const ent = ecs.getEntity(payload.entityId);
        if (!ent) return;
        if (payload.position && ent.components.position) {
          ent.components.position.x = payload.position.x;
          ent.components.position.y = payload.position.y;
          ent.components.position.z = payload.position.z;
        }
        if (payload.hpPercent !== undefined && ent.components.stats) {
          ent.components.stats.currentHp = Math.round((payload.hpPercent / 100) * ent.components.stats.maxHp);
        }
      },
      onMapLoad: (payload: ZCMapLoadPayload) => {
        if (payload.seed !== undefined) {
          // Procedural map — build MapInstance from seed/grid
          const store = useGameStore.getState();
          const mapInstance = worldRuntime.createProceduralMap(
            payload.mapId,
            payload.seed,
            payload.width,
            payload.height,
            payload.grid,
            payload.tileSize ?? 2,
          );
          worldRuntime.loadProceduralMap(payload.mapId, mapInstance, store);
        }
      },
      onMapChange: (payload) => {
        const store = useGameStore.getState();
        const isProcedural = store.currentMap?.seed != null;
        if (isProcedural) {
          // Procedural map already loaded by onMapLoad; just reposition the player
          const player = store.ecsWorld.getEntity(store.playerEntityId);
          if (player?.components.position) {
            player.components.position.x = payload.position.x;
            player.components.position.y = payload.position.y;
            player.components.position.targetX = undefined;
            player.components.position.targetY = undefined;
            player.components.position.path = [];
          }
        } else {
          // Static map — load from JSON registry
          worldRuntime.loadMap(payload.mapId, store, payload.position.x, payload.position.y, false);
        }
      },
      onGroundItemSpawn: (payload) => {
        const store = useGameStore.getState();
        const newItem = {
          id: payload.id,
          itemId: payload.itemId,
          quantity: payload.quantity,
          x: payload.x,
          y: payload.y,
          droppedAt: Date.now(),
        };
        store.addGroundItem(newItem);
      },
      onGroundItemDespawn: (payload) => {
        const store = useGameStore.getState();
        store.removeGroundItem(payload.id);
      },
      onStatUpdate: (payload: ZCStatUpdatePayload) => {
        const store = useGameStore.getState();
        const player = store.ecsWorld.getEntity(store.playerEntityId);
        if (!player?.components.stats) return;
        const stats = player.components.stats as any;
        stats.str = payload.str;
        stats.agi = payload.agi;
        stats.vit = payload.vit;
        stats.int = payload.int;
        stats.dex = payload.dex;
        stats.luk = payload.luk;
        stats.statPoints = payload.statPoints;
        stats.maxHp = payload.maxHp;
        stats.maxSp = payload.maxSp;
        stats.currentHp = Math.min(stats.currentHp, payload.maxHp);
        stats.currentSp = Math.min(stats.currentSp, payload.maxSp);
        store.recalculatePlayerStats();
        store.addLog(`Stats updated — STR:${payload.str} AGI:${payload.agi} VIT:${payload.vit} INT:${payload.int} DEX:${payload.dex} LUK:${payload.luk}`, "system");
      },
      onHpSpUpdate: (payload: ZCHpSpUpdatePayload) => {
        const ecs = useGameStore.getState().ecsWorld;
        const player = ecs.getEntity(useGameStore.getState().playerEntityId);
        if (player?.components.stats) {
          player.components.stats.currentHp = payload.currentHp;
          player.components.stats.maxHp = payload.maxHp;
          player.components.stats.currentSp = payload.currentSp;
          player.components.stats.maxSp = payload.maxSp;
        }
      },
      onExpUpdate: (payload: ZCExpUpdatePayload) => {
        const store = useGameStore.getState();
        const player = store.ecsWorld.getEntity(store.playerEntityId);
        if (!player?.components.stats || !player.components.job) return;
        const stats = player.components.stats as any;
        stats.baseXp = payload.baseXp;
        stats.jobXp = payload.jobXp;
        stats.xpNeededBase = payload.xpNeededBase;
        stats.xpNeededJob = payload.xpNeededJob;
        store.addLog(`EXP: ${payload.baseXp}/${payload.xpNeededBase}`, "system");
      },
      onLevelUp: (payload: ZCLevelUpPayload) => {
        const store = useGameStore.getState();
        const player = store.ecsWorld.getEntity(store.playerEntityId);
        if (!player?.components.job || !player.components.stats) return;
        player.components.job.baseLevel = payload.baseLevel;
        player.components.job.jobLevel = payload.jobLevel;
        player.components.job.skillPoints = (player.components.job.skillPoints ?? 0) + payload.skillPoints;
        const stats = player.components.stats as any;
        stats.statPoints = (stats.statPoints ?? 0) + payload.statPoints;
        store.recalculatePlayerStats();
        store.addLog(`Level up! You are now base level ${payload.baseLevel}.`, "system");
        store.addNotification({
          type: "levelup",
          title: "Level Up!",
          message: `You reached base level ${payload.baseLevel}!`,
          durationMs: 5000,
        });
      },
      onInventoryUpdate: (payload: ZCInventoryUpdatePayload) => {
        const store = useGameStore.getState();
        const player = store.ecsWorld.getEntity(store.playerEntityId);
        if (player?.components.inventory) {
          player.components.inventory.slots = payload.slots;
        }
      },
      onSkillCast: () => {},
      onChatMessage: (payload: ZCChatMessagePayload) => {
        useGameStore.getState().addLog(
          `[${payload.type}] ${payload.senderName || payload.senderId}: ${payload.message}`,
          "chat",
        );
      },
      onPong: () => {},
      onReconnecting: (attempt) => {
        console.log(`[WS] reconnecting attempt ${attempt}...`);
      },
      onError: (code, message) => {
        setCharError(`${code}: ${message}`);
      },
      onDisconnect: () => {
        setPhase((prev) => prev === "ingame" ? "reconnecting" : "login");
      },
    });

    ws.connect();
    ws.auth(token);
    setChannel(ws);
    setLocalChannel(ws);
  }, [email, password, handleEntitySpawn, handleEntityDespawn, handleEntityMove, channel]);

  const onSignUp = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError("Check your email for confirmation link, then log in.");
    }
  }, [email, password]);

  const onCreateCharacter = useCallback(() => {
    if (!channel || !newCharName.trim()) return;
    setCharError(null);
    channel.createCharacter(newCharName.trim(), newCharJob);
  }, [channel, newCharName, newCharJob]);

  const onSelectCharacter = useCallback(
    (characterId: string) => {
      if (!channel) return;
      lastCharacterId.current = characterId;
      setPhase("entering");
      channel.selectCharacter(characterId);
    },
    [channel]
  );

  useEffect(() => {
    return () => {
      channel?.disconnect();
      setChannel(null);
    };
  }, [channel]);

  if (phase === "ingame") {
    return <>{children}</>;
  }

  if (phase === "reconnecting") {
    return <ReconnectingScreen />;
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="bg-slate-900 rounded-xl p-8 w-full max-w-md border border-slate-700">
        {phase === "login" && (
          <LoginScreen
            email={email}
            password={password}
            authError={authError}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onLogin={onLogin}
            onSignUp={onSignUp}
          />
        )}
        {phase === "characters" && (
          <CharacterSelectScreen
            characters={characters}
            charError={charError}
            newCharName={newCharName}
            onSelectCharacter={onSelectCharacter}
            onCreateCharacter={onCreateCharacter}
            onNewCharNameChange={setNewCharName}
          />
        )}
        {phase === "entering" && <EnteringScreen />}
      </div>
    </div>
  );
}
