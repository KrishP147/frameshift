"use client";

import type { Detection } from "@/lib/mock-data";

interface BoundingBoxProps {
  detection: Detection;
  isSelected: boolean;
  onClick: () => void;
}

export function BoundingBox({ detection, isSelected, onClick }: BoundingBoxProps) {
  const { label, confidence, bbox } = detection;
  const [x, y, w, h] = bbox;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute cursor-pointer transition-all duration-200 group focus:outline-none ${
        isSelected ? "z-10" : "z-0"
      }`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
      }}
      aria-label={`${label} (${Math.round(confidence * 100)}%)`}
    >
      <div
        className={`absolute inset-0 rounded-sm border-2 transition-all duration-200 ${
          isSelected
            ? "border-[var(--accent)] bg-[var(--accent)]/10"
            : "border-[var(--accent)]/50 group-hover:border-[var(--accent)] bg-transparent group-hover:bg-[var(--accent)]/5"
        }`}
      />
      <span
        className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-all ${
          isSelected
            ? "bg-[var(--accent)] text-white"
            : "bg-[var(--accent)]/80 text-white opacity-0 group-hover:opacity-100"
        }`}
      >
        {label} {Math.round(confidence * 100)}%
      </span>
      {isSelected && (
        <>
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-[var(--accent)] rounded-full" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--accent)] rounded-full" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[var(--accent)] rounded-full" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[var(--accent)] rounded-full" />
        </>
      )}
    </button>
  );
}
