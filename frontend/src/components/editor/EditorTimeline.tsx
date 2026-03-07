"use client";

import { useCallback, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Plus } from "lucide-react";

interface EditorTimelineProps {
  videoLoaded: boolean;
  currentFrame: number;
  totalFrames: number;
  duration: number;
  fps: number;
  isPlaying: boolean;
  isProcessing: boolean;
  zoom: number;
  onFrameChange: (frame: number) => void;
  onTogglePlay: () => void;
  onZoomChange: (zoom: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EditorTimeline({
  videoLoaded,
  currentFrame,
  totalFrames,
  duration,
  fps,
  isPlaying,
  isProcessing,
  zoom,
  onFrameChange,
  onTogglePlay,
  onZoomChange,
}: EditorTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const currentTime = totalFrames > 0 ? (currentFrame / fps) : 0;
  const progress = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current || !videoLoaded) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onFrameChange(Math.round(pct * (totalFrames - 1)));
    },
    [totalFrames, videoLoaded, onFrameChange]
  );

  return (
    <div className="h-[140px] border-t border-[var(--border-dark)] bg-[#111827] flex flex-col">
      {/* Playback controls */}
      <div className="flex items-center justify-center gap-4 py-2 border-b border-[var(--border-dark)]">
        <span className="text-white/40 text-xs font-mono w-10 text-right">
          {formatTime(currentTime)}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={!videoLoaded}
            onClick={() => onFrameChange(Math.max(0, currentFrame - 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={!videoLoaded}
            onClick={onTogglePlay}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-[#111827] hover:scale-105 transition-all disabled:opacity-30"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
            )}
          </button>
          <button
            disabled={!videoLoaded}
            onClick={() => onFrameChange(Math.min(totalFrames - 1, currentFrame + 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
        <span className="text-white/40 text-xs font-mono w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Timeline track */}
      <div className="flex-1 flex flex-col px-4 py-2 gap-2">
        <div className="relative">
          <div className="flex justify-between text-white/20 text-[9px] font-mono mb-1 px-0.5">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i}>{formatTime((duration / 5) * i)}</span>
            ))}
          </div>
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="h-8 rounded-lg bg-white/5 cursor-pointer relative overflow-hidden group"
          >
            {videoLoaded && (
              <div className="absolute inset-0 flex">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 border-r border-white/5"
                    style={{
                      background: `hsl(${220 + i * 3}, 30%, ${12 + (i % 3) * 2}%)`,
                    }}
                  />
                ))}
              </div>
            )}
            {videoLoaded && (
              <div
                className="absolute top-0 left-0 h-full bg-[var(--accent)]/15 transition-all duration-75"
                style={{ width: `${progress}%` }}
              />
            )}
            {videoLoaded && (
              <div
                className="absolute top-0 h-full w-0.5 bg-[var(--accent)] transition-all duration-75 z-10"
                style={{ left: `${progress}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[var(--accent)] rotate-45 rounded-sm" />
              </div>
            )}
            {isProcessing && (
              <div className="absolute inset-0 bg-[var(--accent)]/10">
                <div className="h-full bg-[var(--accent)]/20 animate-progress-bar" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>or drag and drop media</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="25"
              max="200"
              value={zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-20 accent-[var(--accent)]"
            />
            <span className="text-white/40 text-[10px] font-mono w-8">
              {zoom}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
