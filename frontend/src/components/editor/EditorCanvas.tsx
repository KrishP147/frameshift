"use client";

import type { Detection, EditMode, EditParams } from "@/lib/mock-data";
import { BoundingBox } from "./BoundingBox";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface EditorCanvasProps {
  projectId: string | null;
  videoLoaded: boolean;
  detections: Detection[];
  isDetecting: boolean;
  isSegmenting: boolean;
  maskCount: number;
  selectedObjectId: string | null;
  editMode: EditMode | null;
  editParams: EditParams;
  isProcessing: boolean;
  zoom: number;
  currentFrame: number;
  onSelectObject: (id: string | null) => void;
  onUpload: () => void;
}

export function EditorCanvas({
  projectId,
  videoLoaded,
  detections,
  isDetecting,
  isSegmenting,
  maskCount,
  selectedObjectId,
  editMode,
  editParams,
  isProcessing,
  zoom,
  currentFrame,
  onSelectObject,
  onUpload,
}: EditorCanvasProps) {
  if (!videoLoaded) {
    return <EmptyCanvas onUpload={onUpload} />;
  }

  // frame_index is 1-based in the backend
  const frameUrl = projectId
    ? `${API_URL}/frame/${projectId}/${currentFrame + 1}`
    : null;

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] overflow-hidden relative">
      <div
        className="relative"
        style={{ transform: `scale(${zoom / 100})`, transition: "transform 200ms ease" }}
        onClick={() => onSelectObject(null)}
      >
        <div className="w-[768px] h-[432px] rounded-xl overflow-hidden relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] shadow-2xl">
          {frameUrl ? (
            <img
              src={frameUrl}
              alt={`Frame ${currentFrame + 1}`}
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white/20 text-sm">Frame Preview</div>
            </div>
          )}

          {isDetecting && (
            <div className="absolute inset-0 animate-detection-shimmer rounded-xl z-20 pointer-events-none" />
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-sm font-medium">Applying edit...</span>
              </div>
            </div>
          )}

          {/* SAM 2 mask overlay */}
          {projectId && maskCount > 0 && !isSegmenting && (
            <img
              src={`${API_URL}/mask/${projectId}/${currentFrame + 1}`}
              alt="Segmentation mask"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[1] mix-blend-screen opacity-40"
              style={{ filter: "hue-rotate(-30deg) saturate(3)" }}
            />
          )}

          {/* Segmenting spinner */}
          {isSegmenting && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="flex flex-col items-center gap-2 bg-black/60 px-4 py-3 rounded-xl">
                <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-white/80 text-xs font-medium">Segmenting...</span>
              </div>
            </div>
          )}

          {detections.map((det) => (
            <BoundingBox
              key={det.id}
              detection={det}
              isSelected={selectedObjectId === det.id}
              onClick={() => onSelectObject(det.id)}
            />
          ))}

          {selectedObjectId && editMode && (
            <EditPreviewOverlay
              detection={detections.find((d) => d.id === selectedObjectId)!}
              editMode={editMode}
              editParams={editParams}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyCanvas({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
      <div
        className="flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed border-[var(--border-dark)] hover:border-[var(--accent)]/50 transition-all cursor-pointer group"
        onClick={onUpload}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[var(--accent)]/10 transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40 group-hover:text-[var(--accent)] transition-colors">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white/60 text-sm font-medium">Upload a video to start editing</p>
          <p className="text-white/30 text-xs mt-1">Drag and drop or click to browse</p>
        </div>
      </div>
    </div>
  );
}

function EditPreviewOverlay({
  detection,
  editMode,
  editParams,
}: {
  detection: Detection;
  editMode: EditMode;
  editParams: EditParams;
}) {
  const [x, y, w, h] = detection.bbox;

  if (editMode === "recolor") {
    return (
      <div
        className="absolute pointer-events-none z-5 rounded-sm transition-all duration-300"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          width: `${w}%`,
          height: `${h}%`,
          backgroundColor: editParams.recolor.color,
          opacity: editParams.recolor.opacity * 0.4,
          mixBlendMode: "overlay",
        }}
      />
    );
  }

  if (editMode === "resize") {
    return (
      <div
        className="absolute border-2 border-dashed border-blue-400/60 pointer-events-none z-5 rounded-sm transition-all duration-300"
        style={{
          left: `${x - (w * (editParams.resize.scale - 1)) / 2}%`,
          top: `${y - (h * (editParams.resize.scale - 1)) / 2}%`,
          width: `${w * editParams.resize.scale}%`,
          height: `${h * editParams.resize.scale}%`,
        }}
      />
    );
  }

  if (editMode === "replace") {
    return (
      <div
        className="absolute pointer-events-none z-5 rounded-sm border-2 border-dashed border-emerald-400/60 flex items-center justify-center transition-all duration-300"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          width: `${w}%`,
          height: `${h}%`,
        }}
      >
        <span className="text-emerald-400/80 text-[9px] font-medium">REPLACE</span>
      </div>
    );
  }

  return null;
}
