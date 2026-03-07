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
  timestamp: number;
}

export const MOCK_DETECTIONS: Detection[] = [
  { id: "obj-1", label: "person", confidence: 0.98, bbox: [10, 8, 25, 65] },
  { id: "obj-2", label: "bottle", confidence: 0.94, bbox: [52, 35, 10, 22] },
  { id: "obj-3", label: "laptop", confidence: 0.91, bbox: [38, 30, 26, 28] },
];

export const MOCK_VIDEO = {
  name: "demo-clip.mp4",
  duration: 5,
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
