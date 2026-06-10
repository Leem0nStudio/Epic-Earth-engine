"use client";

import { useEffect } from "react";
import { useGameStore } from "../../core/store";

export default function InputDetector() {
  const setInputMode = useGameStore((s) => s.setInputMode);
  const setPanelLayout = useGameStore((s) => s.setPanelLayout);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");

    const detect = () => {
      const isTouch = mq.matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
      setInputMode(isTouch ? "touch" : "keyboard");
    };

    const updateLayout = () => {
      const w = window.innerWidth;
      if (w < 640) setPanelLayout("mobile");
      else if (w < 1024) setPanelLayout("tablet");
      else setPanelLayout("desktop");
    };

    detect();
    updateLayout();
    mq.addEventListener("change", detect);
    window.addEventListener("resize", updateLayout);

    return () => {
      mq.removeEventListener("change", detect);
      window.removeEventListener("resize", updateLayout);
    };
  }, [setInputMode, setPanelLayout]);

  return null;
}
