"use client";

import { useState } from "react";
import { Play, Share2, Download, ChevronLeft } from "lucide-react";

interface EditorTopBarProps {
  videoName: string;
  onNameChange: (name: string) => void;
  videoLoaded: boolean;
}

export function EditorTopBar({
  videoName,
  onNameChange,
  videoLoaded,
}: EditorTopBarProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-[var(--border-dark)] bg-[#111827]">
      {/* Left: Logo + Back */}
      <div className="flex items-center gap-3">
        <a
          href="/"
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <Play className="w-3 h-3 text-white ml-0.5" fill="white" />
          </div>
        </a>

        {videoLoaded ? (
          isEditing ? (
            <input
              type="text"
              value={videoName}
              onChange={(e) => onNameChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditing(false)}
              autoFocus
              className="bg-transparent text-white text-sm font-medium border-b border-[var(--accent)] outline-none px-1 py-0.5"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-white text-sm font-medium hover:text-[var(--accent)] transition-colors px-1 py-0.5"
            >
              {videoName}
            </button>
          )
        ) : (
          <span className="text-white/40 text-sm">FrameShift Editor</span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          disabled={!videoLoaded}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
        <button
          disabled={!videoLoaded}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </div>
    </header>
  );
}
