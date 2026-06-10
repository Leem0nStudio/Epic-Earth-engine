"use client";

import React, { useEffect, useState } from "react";
import { useGameStore } from "../core/store";
import { GameClock } from "../core/game-loop";
import GameScreen from "./screens/GameScreen";

export default function GameClient() {
  const [clock] = useState(() => new GameClock());

  const isInitializing = useGameStore((state) => state.isInitializing);
  const initializeGame = useGameStore((state) => state.initializeGame);

  useEffect(() => {
    initializeGame();
    clock.start();
    return () => {
      clock.stop();
    };
  }, [initializeGame, clock]);

  if (isInitializing) {
    return (
      <div className="w-full h-screen bg-surface-900 flex flex-col items-center justify-center text-surface-300">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gold-500 border-t-transparent mb-4" />
        <p className="text-xs uppercase tracking-widest text-surface-400">Loading world...</p>
      </div>
    );
  }

  return <GameScreen />;
}
