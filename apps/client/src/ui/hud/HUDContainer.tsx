"use client";

import StatusBars from "./StatusBars";
import ExpBar from "./ExpBar";
import LocationInfo from "./LocationInfo";
import MiniMap from "./MiniMap";
import ZenyDisplay from "./ZenyDisplay";

export default function HUDContainer() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-surface-800/90 backdrop-blur-sm border-b border-gold-500/10 px-2 py-1">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-px">
          <StatusBars />
          <ExpBar />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            <LocationInfo />
            <ZenyDisplay />
          </div>
          <MiniMap />
        </div>
      </div>
    </header>
  );
}
