"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "../../core/store";
import InputDetector from "../systems/InputDetector";
import NotificationToast from "../systems/NotificationToast";
import CastBar from "../systems/CastBar";
import DamageNumbers from "../systems/DamageNumbers";
import DeathOverlay from "../systems/DeathOverlay";
import useKeyboardShortcuts from "../systems/useKeyboardShortcuts";
import HUDContainer from "../hud/HUDContainer";
import ChatPanel from "../chat/ChatPanel";
import HotbarPanel from "../hotbar/HotbarPanel";
import StatsPanel from "../panels/StatsPanel";
import EquipmentPanel from "../panels/EquipmentPanel";
import InventoryPanel from "../panels/InventoryPanel";
import SkillTreePanel from "../panels/SkillTreePanel";

const ThreeCanvas = dynamic(() => import("../ThreeCanvas"), { ssr: false });

function PanelHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-surface-800 border-b border-gold-500/15">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-gold-400">{title}</h2>
      <button
        className="w-6 h-6 flex items-center justify-center text-surface-300 hover:text-surface-100 transition-colors text-sm"
        onClick={onClose}
        aria-label="Close panel"
      >
        ✕
      </button>
    </div>
  );
}

const PANEL_TITLES: Record<string, string> = {
  inventory: "Inventory",
  equipment: "Equipment",
  skillTree: "Skills",
  stats: "Stats",
};

const PANEL_COMPONENTS: Record<string, React.FC> = {
  inventory: InventoryPanel,
  equipment: EquipmentPanel,
  skillTree: SkillTreePanel,
  stats: StatsPanel,
};

function SidePanel() {
  const activePanels = useGameStore((s) => s.activePanels);
  const togglePanel = useGameStore((s) => s.togglePanel);
  const panelLayout = useGameStore((s) => s.panelLayout);

  const openPanel = (Object.keys(activePanels) as (keyof typeof activePanels)[]).find(
    (k) => activePanels[k] && k !== "chat" && k !== "npcDialog"
  );

  if (!openPanel) return null;

  const PanelComponent = PANEL_COMPONENTS[openPanel];
  const title = PANEL_TITLES[openPanel] || openPanel;

  return (
    <aside
      className={`
        fixed z-50 flex flex-col bg-surface-700/95 backdrop-blur-sm border border-gold-500/20 overflow-y-auto
        ${panelLayout === "mobile"
          ? "inset-0 animate-slide-up"
          : "top-0 right-0 bottom-16 w-[400px] lg:w-[480px] animate-slide-in-right"
        }
      `}
    >
      <PanelHeader title={title} onClose={() => togglePanel(openPanel)} />
      {PanelComponent ? <PanelComponent /> : (
        <div className="p-3 text-surface-300 text-xs text-center">Panel content coming soon</div>
      )}
    </aside>
  );
}

export default function GameScreen() {
  useKeyboardShortcuts();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-surface-900">
      <InputDetector />
      <NotificationToast />
      <CastBar />
      <DamageNumbers />
      <DeathOverlay />

      {/* 3D Scene */}
      <div className="absolute inset-0">
        <ThreeCanvas />
      </div>

      {/* HUD (top) */}
      <HUDContainer />

      {/* Chat (bottom-left) */}
      <ChatPanel />

      {/* Hotbar (bottom-center) */}
      <HotbarPanel />

      {/* Side Panel (inventory/equipment/skills/stats) */}
      <SidePanel />
    </div>
  );
}
