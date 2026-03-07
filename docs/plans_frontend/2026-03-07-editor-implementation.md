# Editor Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full FrameShift editor page with mock data — Canva-inspired layout with minimal aesthetic, matching the landing page design system.

**Architecture:** Next.js App Router page at `/editor/[projectId]`. Single `useEditorState` hook manages all state. No external packages needed — bounding box overlays use absolute-positioned divs over an image (Konva.js deferred to backend integration phase). All data is mock.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Lucide React, Clash Display font

---

### Task 1: Create mock data and TypeScript types

**Files:**
- Create: `src/lib/mock-data.ts`

**Step 1: Create the types and mock data file**

```typescript
// src/lib/mock-data.ts

export interface Detection {
  id: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height] as percentages
}

export interface EditParams {
  recolor: { color: string; opacity: number };
  resize: { scale: number };
  replace: { imageUrl: string | null };
}

export type EditMode = "recolor" | "resize" | "replace";

export interface FrameData {
  index: number;
  timestamp: number; // seconds
}

export const MOCK_DETECTIONS: Detection[] = [
  { id: "obj-1", label: "person", confidence: 0.98, bbox: [10, 8, 25, 65] },
  { id: "obj-2", label: "bottle", confidence: 0.94, bbox: [52, 35, 10, 22] },
  { id: "obj-3", label: "laptop", confidence: 0.91, bbox: [38, 30, 26, 28] },
];

export const MOCK_VIDEO = {
  name: "demo-clip.mp4",
  duration: 5, // seconds
  fps: 30,
  frameCount: 150,
  width: 1920,
  height: 1080,
};

export const COLOR_PRESETS = [
  "#F43F5E", "#EF4444", "#F59E0B", "#10B981",
  "#0EA5E9", "#8B5CF6", "#EC4899", "#171717",
];

export function generateFrames(count: number): FrameData[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    timestamp: i / 30,
  }));
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/mock-data.ts 2>&1 || echo "check manually"`
Expected: No errors (or check via dev server)

**Step 3: Commit**

```bash
git add src/lib/mock-data.ts
git commit -m "feat: add editor mock data and TypeScript types"
```

---

### Task 2: Create useEditorState hook

**Files:**
- Create: `src/hooks/useEditorState.ts`

**Step 1: Create the central state hook**

```typescript
// src/hooks/useEditorState.ts
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type Detection,
  type EditMode,
  type EditParams,
  type FrameData,
  MOCK_DETECTIONS,
  MOCK_VIDEO,
  generateFrames,
} from "@/lib/mock-data";

interface EditorState {
  // Video
  videoLoaded: boolean;
  videoName: string;
  duration: number;
  fps: number;
  frames: FrameData[];
  currentFrame: number;
  isPlaying: boolean;

  // Detection
  detections: Detection[];
  isDetecting: boolean;
  selectedObjectId: string | null;

  // Edit
  editMode: EditMode | null;
  editParams: EditParams;
  isProcessing: boolean;
  applyToAllFrames: boolean;

  // UI
  zoom: number;
  showEditPanel: boolean;
}

const DEFAULT_EDIT_PARAMS: EditParams = {
  recolor: { color: "#F43F5E", opacity: 0.6 },
  resize: { scale: 1.0 },
  replace: { imageUrl: null },
};

export function useEditorState() {
  const [state, setState] = useState<EditorState>({
    videoLoaded: false,
    videoName: "",
    duration: 0,
    fps: 30,
    frames: [],
    currentFrame: 0,
    isPlaying: false,

    detections: [],
    isDetecting: false,
    selectedObjectId: null,

    editMode: null,
    editParams: DEFAULT_EDIT_PARAMS,
    isProcessing: false,
    applyToAllFrames: true,

    zoom: 100,
    showEditPanel: false,
  });

  const loadVideo = useCallback(() => {
    setState((s) => ({
      ...s,
      videoLoaded: true,
      videoName: MOCK_VIDEO.name,
      duration: MOCK_VIDEO.duration,
      fps: MOCK_VIDEO.fps,
      frames: generateFrames(MOCK_VIDEO.frameCount),
    }));
  }, []);

  const detectObjects = useCallback(() => {
    setState((s) => ({ ...s, isDetecting: true }));
    // Simulate detection delay
    setTimeout(() => {
      setState((s) => ({
        ...s,
        isDetecting: false,
        detections: MOCK_DETECTIONS,
      }));
    }, 1200);
  }, []);

  const selectObject = useCallback((id: string | null) => {
    setState((s) => ({
      ...s,
      selectedObjectId: id,
      showEditPanel: id !== null,
      editMode: id !== null ? "recolor" : null,
    }));
  }, []);

  const setEditMode = useCallback((mode: EditMode) => {
    setState((s) => ({ ...s, editMode: mode }));
  }, []);

  const updateEditParams = useCallback(
    (mode: EditMode, params: Partial<EditParams[EditMode]>) => {
      setState((s) => ({
        ...s,
        editParams: {
          ...s.editParams,
          [mode]: { ...s.editParams[mode], ...params },
        },
      }));
    },
    []
  );

  const applyEdit = useCallback(() => {
    setState((s) => ({ ...s, isProcessing: true }));
    setTimeout(() => {
      setState((s) => ({
        ...s,
        isProcessing: false,
      }));
    }, 2000);
  }, []);

  const setCurrentFrame = useCallback((frame: number) => {
    setState((s) => ({ ...s, currentFrame: frame }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((s) => ({ ...s, isPlaying: !s.isPlaying }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState((s) => ({ ...s, zoom }));
  }, []);

  const setApplyToAllFrames = useCallback((value: boolean) => {
    setState((s) => ({ ...s, applyToAllFrames: value }));
  }, []);

  const closeEditPanel = useCallback(() => {
    setState((s) => ({
      ...s,
      selectedObjectId: null,
      showEditPanel: false,
      editMode: null,
    }));
  }, []);

  const setVideoName = useCallback((name: string) => {
    setState((s) => ({ ...s, videoName: name }));
  }, []);

  const selectedObject = useMemo(
    () => state.detections.find((d) => d.id === state.selectedObjectId) ?? null,
    [state.detections, state.selectedObjectId]
  );

  return {
    ...state,
    selectedObject,
    loadVideo,
    detectObjects,
    selectObject,
    setEditMode,
    updateEditParams,
    applyEdit,
    setCurrentFrame,
    togglePlay,
    setZoom,
    setApplyToAllFrames,
    closeEditPanel,
    setVideoName,
  };
}
```

**Step 2: Verify it compiles**

Run dev server: `npm run dev` and check for errors.

**Step 3: Commit**

```bash
git add src/hooks/useEditorState.ts
git commit -m "feat: add useEditorState hook for editor state management"
```

---

### Task 3: Add editor CSS animations to globals.css

**Files:**
- Modify: `src/app/globals.css` (append at end, before reduced motion block)

**Step 1: Add editor-specific animations**

Append these before the `@media (prefers-reduced-motion)` block in `globals.css`:

```css
/* ─── Editor Animations ─── */
@keyframes slide-in-right {
  0% { transform: translateX(100%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

@keyframes slide-out-right {
  0% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(100%); opacity: 0; }
}

@keyframes detection-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes progress-bar {
  0% { width: 0%; }
  100% { width: 100%; }
}

@keyframes toast-in {
  0% { transform: translateY(16px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes toast-out {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(16px); opacity: 0; }
}

@keyframes bbox-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.animate-slide-in-right {
  animation: slide-in-right 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.animate-slide-out-right {
  animation: slide-out-right 200ms ease-in forwards;
}

.animate-detection-shimmer {
  background: linear-gradient(90deg, transparent 0%, rgba(244,63,94,0.15) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: detection-shimmer 1s linear infinite;
}

.animate-progress-bar {
  animation: progress-bar 2s linear forwards;
}

.animate-toast-in {
  animation: toast-in 400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.animate-bbox-pulse {
  animation: bbox-pulse 1.5s ease-in-out infinite;
}
```

**Step 2: Verify no CSS errors**

Run: `npm run dev` — page should load without CSS errors.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add editor CSS animations"
```

---

### Task 4: Create EditorTopBar component

**Files:**
- Create: `src/components/editor/EditorTopBar.tsx`

**Step 1: Create the component**

```tsx
// src/components/editor/EditorTopBar.tsx
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

        {/* Project Name */}
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
```

**Step 2: Verify renders**

Will verify when wired into the editor page (Task 9).

**Step 3: Commit**

```bash
git add src/components/editor/EditorTopBar.tsx
git commit -m "feat: add EditorTopBar component"
```

---

### Task 5: Create EditorSidebar component

**Files:**
- Create: `src/components/editor/EditorSidebar.tsx`

**Step 1: Create the component**

```tsx
// src/components/editor/EditorSidebar.tsx
"use client";

import { useState } from "react";
import {
  Upload,
  ScanSearch,
  Paintbrush,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface SidebarItem {
  id: string;
  icon: LucideIcon;
  label: string;
  action: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface EditorSidebarProps {
  videoLoaded: boolean;
  isDetecting: boolean;
  onUpload: () => void;
  onDetect: () => void;
  onEditClick: () => void;
}

export function EditorSidebar({
  videoLoaded,
  isDetecting,
  onUpload,
  onDetect,
  onEditClick,
}: EditorSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const items: SidebarItem[] = [
    { id: "upload", icon: Upload, label: "Upload", action: onUpload },
    {
      id: "detect",
      icon: ScanSearch,
      label: "Detect",
      action: onDetect,
      disabled: !videoLoaded,
      loading: isDetecting,
    },
    {
      id: "edit",
      icon: Paintbrush,
      label: "Edit",
      action: onEditClick,
      disabled: !videoLoaded,
    },
    { id: "settings", icon: Settings, label: "Settings", action: () => {} },
  ];

  return (
    <aside className="w-[60px] flex flex-col items-center py-3 gap-1 border-r border-[var(--border-dark)] bg-[#111827]">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setActiveId(item.id);
              item.action();
            }}
            disabled={item.disabled}
            aria-label={item.label}
            title={item.label}
            className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 group
              ${isActive ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-white/50 hover:text-white hover:bg-white/5"}
              ${item.disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {item.loading ? (
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon className="w-[18px] h-[18px]" />
            )}
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-white text-[#171717] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {item.label}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/editor/EditorSidebar.tsx
git commit -m "feat: add EditorSidebar component"
```

---

### Task 6: Create EditorCanvas with bounding box overlays

**Files:**
- Create: `src/components/editor/EditorCanvas.tsx`
- Create: `src/components/editor/BoundingBox.tsx`

**Step 1: Create BoundingBox component**

```tsx
// src/components/editor/BoundingBox.tsx
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
      {/* Border */}
      <div
        className={`absolute inset-0 rounded-sm border-2 transition-all duration-200 ${
          isSelected
            ? "border-[var(--accent)] bg-[var(--accent)]/10"
            : "border-[var(--accent)]/50 group-hover:border-[var(--accent)] bg-transparent group-hover:bg-[var(--accent)]/5"
        }`}
      />
      {/* Label */}
      <span
        className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-all ${
          isSelected
            ? "bg-[var(--accent)] text-white"
            : "bg-[var(--accent)]/80 text-white opacity-0 group-hover:opacity-100"
        }`}
      >
        {label} {Math.round(confidence * 100)}%
      </span>
      {/* Corner handles when selected */}
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
```

**Step 2: Create EditorCanvas component**

```tsx
// src/components/editor/EditorCanvas.tsx
"use client";

import type { Detection, EditMode, EditParams } from "@/lib/mock-data";
import { BoundingBox } from "./BoundingBox";

interface EditorCanvasProps {
  videoLoaded: boolean;
  detections: Detection[];
  isDetecting: boolean;
  selectedObjectId: string | null;
  editMode: EditMode | null;
  editParams: EditParams;
  isProcessing: boolean;
  zoom: number;
  onSelectObject: (id: string | null) => void;
  onUpload: () => void;
}

export function EditorCanvas({
  videoLoaded,
  detections,
  isDetecting,
  selectedObjectId,
  editMode,
  editParams,
  isProcessing,
  zoom,
  onSelectObject,
  onUpload,
}: EditorCanvasProps) {
  if (!videoLoaded) {
    return <EmptyCanvas onUpload={onUpload} />;
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] overflow-hidden relative">
      {/* Canvas container */}
      <div
        className="relative"
        style={{ transform: `scale(${zoom / 100})`, transition: "transform 200ms ease" }}
        onClick={() => onSelectObject(null)}
      >
        {/* Video frame placeholder */}
        <div className="w-[768px] h-[432px] rounded-xl overflow-hidden relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] shadow-2xl">
          {/* Mock video frame content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/20 text-sm">Frame Preview</div>
          </div>

          {/* Detection shimmer overlay */}
          {isDetecting && (
            <div className="absolute inset-0 animate-detection-shimmer rounded-xl z-20 pointer-events-none" />
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-sm font-medium">
                  Applying edit...
                </span>
              </div>
            </div>
          )}

          {/* Bounding boxes */}
          {detections.map((det) => (
            <BoundingBox
              key={det.id}
              detection={det}
              isSelected={selectedObjectId === det.id}
              onClick={() => onSelectObject(det.id)}
            />
          ))}

          {/* Edit preview overlay */}
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
          <p className="text-white/60 text-sm font-medium">
            Upload a video to start editing
          </p>
          <p className="text-white/30 text-xs mt-1">
            Drag and drop or click to browse
          </p>
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
```

**Step 3: Commit**

```bash
git add src/components/editor/EditorCanvas.tsx src/components/editor/BoundingBox.tsx
git commit -m "feat: add EditorCanvas with bounding box overlays"
```

---

### Task 7: Create EditPanel with Recolor, Resize, Replace tabs

**Files:**
- Create: `src/components/editor/EditPanel.tsx`

**Step 1: Create the component**

```tsx
// src/components/editor/EditPanel.tsx
"use client";

import type { Detection, EditMode, EditParams } from "@/lib/mock-data";
import { COLOR_PRESETS } from "@/lib/mock-data";
import { X, Pipette, Maximize2, ImagePlus } from "lucide-react";

interface EditPanelProps {
  show: boolean;
  selectedObject: Detection | null;
  editMode: EditMode | null;
  editParams: EditParams;
  applyToAllFrames: boolean;
  isProcessing: boolean;
  onEditModeChange: (mode: EditMode) => void;
  onParamsChange: (mode: EditMode, params: Record<string, unknown>) => void;
  onApplyToAllChange: (value: boolean) => void;
  onApply: () => void;
  onClose: () => void;
}

export function EditPanel({
  show,
  selectedObject,
  editMode,
  editParams,
  applyToAllFrames,
  isProcessing,
  onEditModeChange,
  onParamsChange,
  onApplyToAllChange,
  onApply,
  onClose,
}: EditPanelProps) {
  if (!show || !selectedObject) return null;

  const tabs: { id: EditMode; label: string; icon: typeof Pipette }[] = [
    { id: "recolor", label: "Recolor", icon: Pipette },
    { id: "resize", label: "Resize", icon: Maximize2 },
    { id: "replace", label: "Replace", icon: ImagePlus },
  ];

  return (
    <div className="w-[300px] border-l border-[var(--border-dark)] bg-[#111827] animate-slide-in-right flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dark)]">
        <div>
          <p className="text-white text-sm font-semibold">{selectedObject.label}</p>
          <p className="text-white/40 text-xs">
            {Math.round(selectedObject.confidence * 100)}% confidence
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-dark)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onEditModeChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
                editMode === tab.id
                  ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {editMode === "recolor" && (
          <RecolorPanel
            params={editParams.recolor}
            onChange={(p) => onParamsChange("recolor", p)}
          />
        )}
        {editMode === "resize" && (
          <ResizePanel
            params={editParams.resize}
            onChange={(p) => onParamsChange("resize", p)}
          />
        )}
        {editMode === "replace" && (
          <ReplacePanel
            params={editParams.replace}
            onChange={(p) => onParamsChange("replace", p)}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border-dark)]">
        {/* Apply to all frames toggle */}
        <label className="flex items-center justify-between mb-3 cursor-pointer">
          <span className="text-white/60 text-xs">Apply to all frames</span>
          <button
            onClick={() => onApplyToAllChange(!applyToAllFrames)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              applyToAllFrames ? "bg-[var(--accent)]" : "bg-white/20"
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                applyToAllFrames ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
        <button
          onClick={onApply}
          disabled={isProcessing}
          className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            "Apply Edit"
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Sub-panels ── */

function RecolorPanel({
  params,
  onChange,
}: {
  params: EditParams["recolor"];
  onChange: (p: Partial<EditParams["recolor"]>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-white/60 text-xs font-medium mb-2 block">Color</label>
        <div className="grid grid-cols-4 gap-2">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              onClick={() => onChange({ color })}
              className={`w-full aspect-square rounded-lg transition-all ${
                params.color === color
                  ? "ring-2 ring-white ring-offset-2 ring-offset-[#111827] scale-110"
                  : "hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="text-white/60 text-xs font-medium mb-2 block">
          Custom hex
        </label>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg border border-[var(--border-dark)]"
            style={{ backgroundColor: params.color }}
          />
          <input
            type="text"
            value={params.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="flex-1 bg-white/5 border border-[var(--border-dark)] rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </div>
      <div>
        <label className="text-white/60 text-xs font-medium mb-2 block">
          Opacity — {Math.round(params.opacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={params.opacity * 100}
          onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
          className="w-full accent-[var(--accent)]"
        />
      </div>
    </div>
  );
}

function ResizePanel({
  params,
  onChange,
}: {
  params: EditParams["resize"];
  onChange: (p: Partial<EditParams["resize"]>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-white/60 text-xs font-medium mb-2 block">
          Scale — {params.scale.toFixed(1)}x
        </label>
        <input
          type="range"
          min="50"
          max="200"
          value={params.scale * 100}
          onChange={(e) => onChange({ scale: Number(e.target.value) / 100 })}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-white/30 text-[10px] mt-1">
          <span>0.5x</span>
          <span>1.0x</span>
          <span>2.0x</span>
        </div>
      </div>
      <div>
        <label className="text-white/60 text-xs font-medium mb-2 block">
          Exact value
        </label>
        <input
          type="number"
          min="0.5"
          max="2.0"
          step="0.1"
          value={params.scale}
          onChange={(e) => onChange({ scale: Number(e.target.value) })}
          className="w-full bg-white/5 border border-[var(--border-dark)] rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>
    </div>
  );
}

function ReplacePanel({
  params,
  onChange,
}: {
  params: EditParams["replace"];
  onChange: (p: Partial<EditParams["replace"]>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-white/60 text-xs font-medium mb-2 block">
          Replacement image
        </label>
        <div
          className="border-2 border-dashed border-[var(--border-dark)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--accent)]/50 transition-colors"
          onClick={() => onChange({ imageUrl: "/placeholder.png" })}
        >
          {params.imageUrl ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <ImagePlus className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-white/60 text-xs">Image selected</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ imageUrl: null });
                }}
                className="text-[var(--accent)] text-xs hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ImagePlus className="w-6 h-6 text-white/30" />
              <p className="text-white/40 text-xs">Click to upload image</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/editor/EditPanel.tsx
git commit -m "feat: add EditPanel with Recolor, Resize, Replace tabs"
```

---

### Task 8: Create EditorTimeline component

**Files:**
- Create: `src/components/editor/EditorTimeline.tsx`

**Step 1: Create the component**

```tsx
// src/components/editor/EditorTimeline.tsx
"use client";

import { useCallback, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Plus,
} from "lucide-react";

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
        {/* Scrubber */}
        <div className="relative">
          {/* Time markers */}
          <div className="flex justify-between text-white/20 text-[9px] font-mono mb-1 px-0.5">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i}>{formatTime((duration / 5) * i)}</span>
            ))}
          </div>
          {/* Track */}
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="h-8 rounded-lg bg-white/5 cursor-pointer relative overflow-hidden group"
          >
            {/* Frame strip visualization */}
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
            {/* Progress fill */}
            {videoLoaded && (
              <div
                className="absolute top-0 left-0 h-full bg-[var(--accent)]/15 transition-all duration-75"
                style={{ width: `${progress}%` }}
              />
            )}
            {/* Playhead */}
            {videoLoaded && (
              <div
                className="absolute top-0 h-full w-0.5 bg-[var(--accent)] transition-all duration-75 z-10"
                style={{ left: `${progress}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[var(--accent)] rotate-45 rounded-sm" />
              </div>
            )}
            {/* Processing progress overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-[var(--accent)]/10">
                <div className="h-full bg-[var(--accent)]/20 animate-progress-bar" />
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
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
```

**Step 2: Commit**

```bash
git add src/components/editor/EditorTimeline.tsx
git commit -m "feat: add EditorTimeline component"
```

---

### Task 9: Create the editor page and wire everything together

**Files:**
- Create: `src/app/editor/[projectId]/page.tsx`

**Step 1: Create the editor page**

```tsx
// src/app/editor/[projectId]/page.tsx
"use client";

import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditPanel } from "@/components/editor/EditPanel";
import { EditorTimeline } from "@/components/editor/EditorTimeline";
import { useEditorState } from "@/hooks/useEditorState";
import { useEffect, useRef } from "react";

export default function EditorPage() {
  const editor = useEditorState();
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Playback loop
  useEffect(() => {
    if (editor.isPlaying && editor.videoLoaded) {
      playIntervalRef.current = setInterval(() => {
        editor.setCurrentFrame(
          editor.currentFrame >= editor.frames.length - 1
            ? 0
            : editor.currentFrame + 1
        );
      }, 1000 / editor.fps);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [editor.isPlaying, editor.videoLoaded, editor.currentFrame, editor.fps, editor.frames.length, editor.setCurrentFrame]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          editor.togglePlay();
          break;
        case "ArrowLeft":
          editor.setCurrentFrame(Math.max(0, editor.currentFrame - 1));
          break;
        case "ArrowRight":
          editor.setCurrentFrame(
            Math.min(editor.frames.length - 1, editor.currentFrame + 1)
          );
          break;
        case "Escape":
          editor.closeEditPanel();
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editor]);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden select-none">
      {/* Top Bar */}
      <EditorTopBar
        videoName={editor.videoName}
        onNameChange={editor.setVideoName}
        videoLoaded={editor.videoLoaded}
      />

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <EditorSidebar
          videoLoaded={editor.videoLoaded}
          isDetecting={editor.isDetecting}
          onUpload={editor.loadVideo}
          onDetect={editor.detectObjects}
          onEditClick={() => {}}
        />

        {/* Canvas */}
        <EditorCanvas
          videoLoaded={editor.videoLoaded}
          detections={editor.detections}
          isDetecting={editor.isDetecting}
          selectedObjectId={editor.selectedObjectId}
          editMode={editor.editMode}
          editParams={editor.editParams}
          isProcessing={editor.isProcessing}
          zoom={editor.zoom}
          onSelectObject={editor.selectObject}
          onUpload={editor.loadVideo}
        />

        {/* Edit Panel */}
        <EditPanel
          show={editor.showEditPanel}
          selectedObject={editor.selectedObject}
          editMode={editor.editMode}
          editParams={editor.editParams}
          applyToAllFrames={editor.applyToAllFrames}
          isProcessing={editor.isProcessing}
          onEditModeChange={editor.setEditMode}
          onParamsChange={editor.updateEditParams}
          onApplyToAllChange={editor.setApplyToAllFrames}
          onApply={editor.applyEdit}
          onClose={editor.closeEditPanel}
        />
      </div>

      {/* Timeline */}
      <EditorTimeline
        videoLoaded={editor.videoLoaded}
        currentFrame={editor.currentFrame}
        totalFrames={editor.frames.length}
        duration={editor.duration}
        fps={editor.fps}
        isPlaying={editor.isPlaying}
        isProcessing={editor.isProcessing}
        zoom={editor.zoom}
        onFrameChange={editor.setCurrentFrame}
        onTogglePlay={editor.togglePlay}
        onZoomChange={editor.setZoom}
      />
    </div>
  );
}
```

**Step 2: Verify in browser**

Run: `npm run dev`
Navigate to: `http://localhost:3000/editor/test-project`
Expected: Full editor layout renders. Empty canvas with upload prompt.

**Step 3: Test user flow**

1. Click the upload drop zone or sidebar Upload icon → video loads
2. Click sidebar Detect icon → shimmer → bounding boxes appear
3. Click a bounding box → edit panel slides in
4. Switch between Recolor/Resize/Replace tabs
5. Click "Apply Edit" → processing spinner
6. Press Escape → edit panel closes
7. Press Space → play/pause
8. Arrow keys → step frames

**Step 4: Commit**

```bash
git add src/app/editor/
git commit -m "feat: add editor page with full UI wired to mock state"
```

---

### Task 10: Polish — Toast notifications, responsive, and reduced motion

**Files:**
- Create: `src/components/editor/Toast.tsx`
- Modify: `src/app/editor/[projectId]/page.tsx` (add toast)
- Modify: `src/hooks/useEditorState.ts` (add toast state)

**Step 1: Create Toast component**

```tsx
// src/components/editor/Toast.tsx
"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";

interface ToastProps {
  message: string;
  show: boolean;
  onHide: () => void;
}

export function Toast({ message, show, onHide }: ToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onHide]);

  if (!show) return null;

  return (
    <div className="fixed bottom-44 left-1/2 -translate-x-1/2 z-50 animate-toast-in">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/90 backdrop-blur-sm text-white text-sm font-medium shadow-lg">
        <Check className="w-4 h-4" />
        {message}
      </div>
    </div>
  );
}
```

**Step 2: Add toast state to useEditorState**

Add to the state interface:
```typescript
toastMessage: string;
showToast: boolean;
```

Add to initial state:
```typescript
toastMessage: "",
showToast: false,
```

Update `applyEdit` to show toast on completion:
```typescript
const applyEdit = useCallback(() => {
  setState((s) => ({ ...s, isProcessing: true }));
  setTimeout(() => {
    setState((s) => ({
      ...s,
      isProcessing: false,
      showToast: true,
      toastMessage: `Edit applied to ${s.applyToAllFrames ? "all 150 frames" : "current frame"}`,
    }));
  }, 2000);
}, []);
```

Add `hideToast`:
```typescript
const hideToast = useCallback(() => {
  setState((s) => ({ ...s, showToast: false }));
}, []);
```

Return `hideToast` from the hook.

**Step 3: Add Toast to editor page**

Add import and component to `page.tsx`:
```tsx
import { Toast } from "@/components/editor/Toast";

// Inside the return, after the closing </div> of the main layout:
<Toast
  message={editor.toastMessage}
  show={editor.showToast}
  onHide={editor.hideToast}
/>
```

**Step 4: Verify everything works end-to-end**

Run: `npm run dev`
Full test: Upload → Detect → Select → Recolor → Apply → Toast appears → Closes after 3s.

**Step 5: Commit**

```bash
git add src/components/editor/Toast.tsx src/hooks/useEditorState.ts src/app/editor/
git commit -m "feat: add toast notifications and polish editor"
```

---

## Summary

| Task | Component | Description |
|------|-----------|-------------|
| 1 | `mock-data.ts` | Types + mock detections, video data, color presets |
| 2 | `useEditorState.ts` | Central state hook for all editor state |
| 3 | `globals.css` | Editor-specific CSS animations |
| 4 | `EditorTopBar.tsx` | Logo, editable project name, Share/Export |
| 5 | `EditorSidebar.tsx` | Slim icon rail with tooltips |
| 6 | `EditorCanvas.tsx` + `BoundingBox.tsx` | Video frame + bbox overlays + edit previews |
| 7 | `EditPanel.tsx` | Floating Recolor/Resize/Replace panel |
| 8 | `EditorTimeline.tsx` | Playback controls, scrubber, frame strip, zoom |
| 9 | `page.tsx` | Editor page wiring all components + keyboard shortcuts |
| 10 | `Toast.tsx` | Toast notifications + final polish |
