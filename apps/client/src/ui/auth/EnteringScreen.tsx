"use client";

import React from "react";

export default function EnteringScreen() {
  return (
    <div className="text-center space-y-4">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
      <p className="text-slate-400">Entering world...</p>
    </div>
  );
}
