"use client";

import React, { useState, useRef, useEffect } from "react";
import { useGameStore } from "../../core/store";

export default function ChatPanel() {
  const logs = useGameStore((s) => s.logs);
  const addLog = useGameStore((s) => s.addLog);
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, expanded]);

  const send = () => {
    if (!input.trim()) return;
    addLog(`You: ${input.trim()}`, "chat");
    setInput("");
  };

  const displayLogs = expanded ? logs : logs.slice(0, 3);

  return (
    <div
      className={`
        absolute bottom-0 left-0 z-40 flex flex-col
        ${expanded ? "w-full sm:w-[400px] h-[240px]" : "w-[320px] h-[96px]"}
        transition-all duration-200
      `}
    >
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 cursor-pointer bg-surface-800/80 backdrop-blur-sm border-t border-r border-gold-500/15"
        onClick={() => setExpanded(!expanded)}
      >
        {displayLogs.map((log) => (
          <div key={log.id} className="text-[10px] leading-tight">
            <span className="text-surface-500">[{log.timestamp}]</span>{" "}
            <span
              className={
                log.type === "system"
                  ? "text-gold-400"
                  : log.type === "battle"
                    ? "text-red-400"
                    : log.type === "chat"
                      ? "text-blue-300"
                      : "text-surface-300"
              }
            >
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {expanded && (
        <div className="flex gap-1 px-2 py-1 bg-surface-900/90 border-t border-r border-gold-500/10">
          <input
            className="flex-1 bg-surface-800 border border-surface-600 px-2 py-1 text-xs text-surface-100 outline-none focus:border-gold-500/50"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          />
          <button
            className="px-3 py-1 text-xs bg-gold-600 hover:bg-gold-500 text-surface-900 font-bold transition-colors"
            onClick={send}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
