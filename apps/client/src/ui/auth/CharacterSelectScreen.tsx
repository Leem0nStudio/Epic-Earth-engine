"use client";

import React from "react";
import type { CharacterEntry } from "@epic-earth/shared";

const JOB_NAMES: Record<string, string> = {
  novice: "Novice",
};

export default function CharacterSelectScreen({
  characters,
  charError,
  newCharName,
  onSelectCharacter,
  onCreateCharacter,
  onNewCharNameChange,
}: {
  characters: CharacterEntry[];
  charError: string | null;
  newCharName: string;
  onSelectCharacter: (id: string) => void;
  onCreateCharacter: () => void;
  onNewCharNameChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-center">Select Character</h2>

      {charError && (
        <div className="bg-red-900/50 border border-red-700 rounded px-3 py-2 text-sm">{charError}</div>
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
        onChange={(e) => onNewCharNameChange(e.target.value)}
      />
      <div className="text-sm text-slate-400">Class: Novice (change jobs in-game)</div>
      <button
        className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
        onClick={onCreateCharacter}
      >
        Create
      </button>
    </div>
  );
}
