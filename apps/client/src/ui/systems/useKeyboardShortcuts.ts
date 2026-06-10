"use client";

import { useEffect } from "react";
import { useGameStore } from "../../core/store";

const SHORTCUTS: Record<string, keyof import("../../core/store").ActivePanels> = {
  KeyI: "inventory",
  KeyQ: "equipment",
  KeyS: "stats",
  KeyW: "skillTree",
  KeyC: "chat",
};

export default function useKeyboardShortcuts() {
  const togglePanel = useGameStore((s) => s.togglePanel);
  const inputMode = useGameStore((s) => s.inputMode);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        inputMode !== "keyboard"
      ) return;

      const panel = SHORTCUTS[e.code];
      if (panel && (e.altKey || e.metaKey)) {
        e.preventDefault();
        togglePanel(panel);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePanel, inputMode]);
}
