"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { WebSocketChannel } from "../network/WebSocketChannel";
import { setChannel } from "../network";
import { useGameStore } from "../core/store";
import type { CharacterEntry, ZCEnterWorldPayload, EntitySnapshot } from "@epic-earth/shared";

type AuthPhase = "login" | "characters" | "entering" | "ingame";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

const JOB_NAMES: Record<string, string> = {
  novice: "Novice",
};

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

  const handleEntitySpawn = useCallback((entity: EntitySnapshot) => {
    const store = useGameStore.getState();
    if (entity.type === "player" && entity.id !== store.playerEntityId) {
      store.spawnNpc(entity.id, entity.name, entity.spriteSheetId, entity.position.x, entity.position.y);
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
    entity.components.position.x = x;
    entity.components.position.y = y;
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
        setPhase("characters");
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
      onEnterWorld: (_payload: ZCEnterWorldPayload) => {
        setPhase("ingame");
      },
      onEntitySpawn: handleEntitySpawn,
      onEntityDespawn: handleEntityDespawn,
      onEntityMove: handleEntityMove,
      onError: (code, message) => {
        setCharError(`${code}: ${message}`);
      },
      onDisconnect: () => {
        setPhase("login");
      },
    });

    ws.connect();
    ws.auth(token);
    setChannel(ws);
    setLocalChannel(ws);
  }, [email, password, handleEntitySpawn, handleEntityDespawn, handleEntityMove]);

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

  return (
    <div className="w-full min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="bg-slate-900 rounded-xl p-8 w-full max-w-md border border-slate-700">

        {phase === "login" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-center mb-6">Epic Earth</h1>
            {authError && (
              <div className="bg-red-900/50 border border-red-700 rounded px-3 py-2 text-sm">
                {authError}
              </div>
            )}
            <input
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 focus:outline-none focus:border-blue-500"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 focus:outline-none focus:border-blue-500"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className="w-full py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
              onClick={onLogin}
            >
              Login
            </button>
            <button
              className="w-full py-2 rounded bg-slate-700 hover:bg-slate-600 font-semibold text-sm"
              onClick={onSignUp}
            >
              Sign Up
            </button>
          </div>
        )}

        {phase === "characters" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center">Select Character</h2>

            {charError && (
              <div className="bg-red-900/50 border border-red-700 rounded px-3 py-2 text-sm">
                {charError}
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {characters.length === 0 && (
                <p className="text-slate-400 text-sm text-center">No characters yet</p>
              )}
              {characters.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600"
                  onClick={() => onSelectCharacter(c.id)}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-slate-400 text-sm ml-2">
                    {JOB_NAMES[c.jobId] || c.jobId} Lv.{c.baseLevel}/{c.jobLevel}
                  </span>
                </button>
              ))}
            </div>

            <hr className="border-slate-700" />
            <h3 className="font-semibold text-sm">Create New Character</h3>

            <input
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 focus:outline-none focus:border-blue-500"
              placeholder="Character name"
              maxLength={16}
              value={newCharName}
              onChange={(e) => setNewCharName(e.target.value)}
            />
            <div className="text-sm text-slate-400">Class: Novice (change jobs in-game)</div>
            <button
              className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
              onClick={onCreateCharacter}
            >
              Create
            </button>
          </div>
        )}

        {phase === "entering" && (
          <div className="text-center space-y-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400">Entering world...</p>
          </div>
        )}

      </div>
    </div>
  );
}
