"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Stage, Layer, Rect, Image as KonvaImage } from "react-konva";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Detection {
  label: string;
  confidence: number;
  bbox: number[];
}

interface ProjectStatus {
  status: string;
  frame_count: number;
  detecting: boolean;
  detected_frames: number;
  detections: Record<string, Detection[]>;
}

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();

  // Project state
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [detectedFrames, setDetectedFrames] = useState(0);
  const cachedDetections = useRef<Record<string, Detection[]>>({});

  // Frame viewer state
  const [currentFrame, setCurrentFrame] = useState(1);
  const currentFrameRef = useRef(1);
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 540 });
  const [imageSize, setImageSize] = useState({ width: 960, height: 540 });

  // Edit state
  const [maskVisible, setMaskVisible] = useState(false);
  const [editType, setEditType] = useState("recolor");
  const [editColor, setEditColor] = useState("#FF0000");
  const [editScale, setEditScale] = useState(1.5);
  const [processing, setProcessing] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const hasLoadedFirstFrame = useRef(false);

  // Poll project status: wait for frames, then keep polling for detections
  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function pollStatus() {
      try {
        const res = await fetch(`${API_URL}/project/${projectId}/status`);
        const data: ProjectStatus = await res.json();
        setProjectStatus(data);

        if (data.frame_count > 0) setFrameCount(data.frame_count);
        if (data.detections) {
          cachedDetections.current = data.detections;
          // Update current frame's bboxes live as YOLO results arrive
          setDetections(data.detections[String(currentFrameRef.current)] || []);
        }
        setDetecting(!!data.detecting);
        setDetectedFrames(data.detected_frames || 0);

        // Load first frame as soon as status is ready (frames extracted)
        if (data.status === "ready" && !hasLoadedFirstFrame.current) {
          hasLoadedFirstFrame.current = true;
          loadFrame(1, data.detections);
        }

        // Stop polling once YOLO is also done
        if (data.status === "ready" && !data.detecting) {
          clearInterval(interval);
        }
      } catch {
        // Backend not reachable yet, keep polling
      }
    }

    pollStatus();
    interval = setInterval(pollStatus, 1500);
    return () => clearInterval(interval);
  }, [projectId]);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const loadFrame = useCallback(
    (index: number, detectionsMap?: Record<string, Detection[]>) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = `${API_URL}/frame/${projectId}/${index}`;
      img.onload = () => {
        // Fit canvas: leave 300px for edit panel + 48px padding, cap height at 65vh
        const container = canvasContainerRef.current;
        const maxW = container ? container.clientWidth - 16 : Math.min(window.innerWidth - 348, 1200);
        const maxH = window.innerHeight * 0.65;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        setCanvasSize({
          width: Math.round(img.width * scale),
          height: Math.round(img.height * scale),
        });
        setImageSize({ width: img.width, height: img.height });
        setFrameImage(img);
      };
      setCurrentFrame(index);
      currentFrameRef.current = index;

      // Use cached detections from background YOLO run
      const dets = detectionsMap || cachedDetections.current;
      setDetections(dets[String(index)] || []);
    },
    [projectId]
  );

  async function handleCanvasClick(e: any) {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const sx = imageSize.width / canvasSize.width;
    const sy = imageSize.height / canvasSize.height;
    const clickX = Math.round(pos.x * sx);
    const clickY = Math.round(pos.y * sy);

    setProcessing("Segmenting object...");
    const res = await fetch(`${API_URL}/segment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        frame_index: currentFrame,
        click_x: clickX,
        click_y: clickY,
      }),
    });
    const data = await res.json();
    setMaskVisible(true);
    setProcessing(`Segmented! ${data.mask_count} masks generated.`);
  }

  async function handleApplyEdit() {
    setProcessing(`Applying ${editType} edit to all frames...`);

    const editParams: Record<string, unknown> = {
      project_id: projectId,
      edit_type: editType,
    };
    if (editType === "recolor") editParams.color = editColor.replace("#", "");
    if (editType === "resize") editParams.scale = editScale;

    await fetch(`${API_URL}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editParams),
    });

    setProcessing("Rendering final video...");
    const renderRes = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    const renderData = await renderRes.json();
    setResultUrl(renderData.video_url);
    setProcessing("Done!");
  }

  const scaleX = canvasSize.width / imageSize.width;
  const scaleY = canvasSize.height / imageSize.height;
  const isReady = projectStatus?.status === "ready";

  // Loading state while frames are being extracted
  if (!isReady) {
    const statusText =
      projectStatus?.status === "extracting"
        ? "Extracting frames from video..."
        : projectStatus?.status === "processing"
          ? "Processing video..."
          : "Loading project...";

    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <header className="flex items-center gap-4 border-b border-white/10 px-8 py-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            FrameShift Editor
          </h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
          <p className="text-lg text-white/50">{statusText}</p>
          {frameCount > 0 && (
            <p className="text-sm text-white/30">{frameCount} frames extracted</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-white/10 px-8 py-4">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          FrameShift Editor
        </h1>
        <span className="font-mono text-xs text-white/30">{projectId}</span>
        {detecting && (
          <div className="ml-auto flex items-center gap-2 text-xs text-white/40">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Detecting objects... {detectedFrames}/{frameCount}</span>
          </div>
        )}
      </header>

      <main className="flex flex-1 gap-6 overflow-hidden p-6">
        {/* Canvas + scrubber */}
        <div className="flex flex-1 min-w-0 flex-col" ref={canvasContainerRef}>
          <div className="overflow-hidden rounded-xl border border-white/10" style={{ width: canvasSize.width, height: canvasSize.height }}>
            <Stage
              width={canvasSize.width}
              height={canvasSize.height}
              onClick={handleCanvasClick}
              style={{ cursor: "crosshair" }}
            >
              <Layer>
                {frameImage && (
                  <KonvaImage
                    image={frameImage}
                    width={canvasSize.width}
                    height={canvasSize.height}
                  />
                )}
                {detections.map((det, i) => (
                  <Rect
                    key={i}
                    x={det.bbox[0] * scaleX}
                    y={det.bbox[1] * scaleY}
                    width={(det.bbox[2] - det.bbox[0]) * scaleX}
                    height={(det.bbox[3] - det.bbox[1]) * scaleY}
                    stroke="#f43f5e"
                    strokeWidth={2}
                    cornerRadius={2}
                  />
                ))}
              </Layer>
            </Stage>
          </div>

          {/* Frame scrubber */}
          <div className="mt-4 flex items-center gap-4">
            <span className="w-24 font-mono text-sm text-white/40">
              Frame {currentFrame}
            </span>
            <input
              type="range"
              min={1}
              max={frameCount}
              value={currentFrame}
              onChange={(e) => loadFrame(Number(e.target.value))}
              className="flex-1 accent-white"
            />
            <span className="w-8 font-mono text-sm text-white/40">
              {frameCount}
            </span>
          </div>
        </div>

        {/* Edit panel */}
        <div className="w-72 shrink-0 space-y-5">
          <h2 className="text-base font-semibold">Edit Object</h2>
          <p className="text-xs text-white/40">
            Click an object on the canvas to segment it, then apply an edit.
          </p>

          {/* Edit type */}
          <div className="space-y-1.5">
            <label className="block text-xs text-white/40">Edit Type</label>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <option value="recolor">Recolor</option>
              <option value="resize">Resize</option>
              <option value="replace">Replace</option>
            </select>
          </div>

          {/* Recolor controls */}
          {editType === "recolor" && (
            <div className="space-y-1.5">
              <label className="block text-xs text-white/40">
                Target Color
              </label>
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-white/10"
              />
            </div>
          )}

          {/* Resize controls */}
          {editType === "resize" && (
            <div className="space-y-1.5">
              <label className="block text-xs text-white/40">
                Scale: {editScale}x
              </label>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={editScale}
                onChange={(e) => setEditScale(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
          )}

          {/* Apply button */}
          <button
            onClick={handleApplyEdit}
            disabled={!maskVisible}
            className="w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-20"
          >
            Apply Edit
          </button>

          {/* Status */}
          {processing && (
            <div className="flex items-center gap-2 text-sm text-white/40">
              {processing !== "Done!" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span>{processing}</span>
            </div>
          )}

          {/* Result video */}
          {resultUrl && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Result</h3>
              <video
                src={resultUrl}
                controls
                className="w-full overflow-hidden rounded-xl border border-white/10"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
