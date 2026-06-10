"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useGameStore } from "../../core/store";

interface FloatText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  createdAt: number;
}

let nextFloatId = 0;

export default function DamageNumbers() {
  const [floats, setFloats] = useState<FloatText[]>([]);
  const logs = useGameStore((s) => s.logs);

  // Extract damage numbers from battle logs
  useEffect(() => {
    if (logs.length === 0) return;
    const latest = logs[0];
    if (latest.type !== "battle") return;

    // Parse "deals X damage" patterns
    const dmgMatch = latest.message.match(/deals (\d+) damage/i);
    const healMatch = latest.message.match(/Healed for (\d+)/i);
    const value = dmgMatch?.[1] || healMatch?.[1];
    if (!value) return;

    const isHeal = !!healMatch;
    const pos = { x: 50 + Math.random() * 20, y: 30 + Math.random() * 10 };

    const float: FloatText = {
      id: nextFloatId++,
      text: isHeal ? `+${value}` : `-${value}`,
      x: pos.x,
      y: pos.y,
      color: isHeal ? "#22c55e" : "#ef4444",
      createdAt: Date.now(),
    };

    setFloats((prev) => [...prev.slice(-8), float]);

    // Remove after animation
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== float.id));
    }, 1200);
  }, [logs]);

  if (floats.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {floats.map((f) => (
        <div
          key={f.id}
          className="absolute text-sm font-bold animate-float-up"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            color: f.color,
            textShadow: "0 0 4px rgba(0,0,0,0.8)",
          }}
        >
          {f.text}
        </div>
      ))}
    </div>
  );
}
