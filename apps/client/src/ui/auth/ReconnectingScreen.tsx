"use client";

import React from "react";

export default function ReconnectingScreen() {
  return (
    <div className="w-full min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="bg-slate-900 rounded-xl p-8 w-full max-w-md border border-slate-700 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-slate-400">Connection lost — reconnecting...</p>
      </div>
    </div>
  );
}
