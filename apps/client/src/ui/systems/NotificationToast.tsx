"use client";

import React, { useEffect } from "react";
import { useGameStore } from "../../core/store";

const TYPE_STYLES: Record<string, string> = {
  info: "border-blue-500/40 bg-blue-600/20",
  success: "border-green-500/40 bg-green-600/20",
  warning: "border-gold-500/40 bg-gold-600/20",
  error: "border-red-500/40 bg-red-600/20",
  levelup: "border-gem-purple/40 bg-purple-600/20",
  loot: "border-gem-green/40 bg-emerald-600/20",
};

const TYPE_ICONS: Record<string, string> = {
  info: "ℹ",
  success: "✓",
  warning: "⚠",
  error: "✕",
  levelup: "⬆",
  loot: "◆",
};

export default function NotificationToast() {
  const notifications = useGameStore((s) => s.notifications);
  const dismissNotification = useGameStore((s) => s.dismissNotification);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-72 pointer-events-none">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} onDismiss={dismissNotification} />
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  onDismiss,
}: {
  notification: {
    id: string;
    type: string;
    title: string;
    message?: string;
    icon?: string;
    durationMs: number;
    timestamp: number;
  };
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (notification.durationMs <= 0) return;
    const timer = setTimeout(() => onDismiss(notification.id), notification.durationMs);
    return () => clearTimeout(timer);
  }, [notification.id, notification.durationMs, onDismiss]);

  return (
    <div
      className={`pointer-events-auto animate-slide-in-right px-3 py-2 rounded border backdrop-blur-sm cursor-pointer
        ${TYPE_STYLES[notification.type] || TYPE_STYLES.info}
        bg-surface-800/90
      `}
      onClick={() => onDismiss(notification.id)}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{notification.icon || TYPE_ICONS[notification.type] || "ℹ"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-surface-100 truncate">{notification.title}</p>
          {notification.message && (
            <p className="text-[10px] text-surface-300 truncate">{notification.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
