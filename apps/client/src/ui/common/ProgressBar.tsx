"use client";

interface ProgressBarProps {
  current: number;
  max: number;
  color: string;
  bgColor?: string;
  height?: string;
  label?: string;
  showText?: boolean;
}

export default function ProgressBar({ current, max, color, bgColor = "bg-surface-800", height = "h-4", label, showText = true }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
  return (
    <div className={`w-full ${height} ${bgColor} border border-surface-500 p-[1px]`}>
      <div className="relative h-full">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
        {showText && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            {label || `${Math.round(current)} / ${max}`}
          </span>
        )}
      </div>
    </div>
  );
}
