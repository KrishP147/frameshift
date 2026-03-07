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
        <label className="text-white/60 text-xs font-medium mb-2 block">Custom hex</label>
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
        <label className="text-white/60 text-xs font-medium mb-2 block">Exact value</label>
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
        <label className="text-white/60 text-xs font-medium mb-2 block">Replacement image</label>
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
