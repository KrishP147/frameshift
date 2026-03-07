"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [frameCount, setFrameCount] = useState(300);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [maskVisible, setMaskVisible] = useState(false);
  const [editType, setEditType] = useState("recolor");
  const [editColor, setEditColor] = useState("#FF0000");
  const [editScale, setEditScale] = useState(1.5);
  const [processing, setProcessing] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 540 });
  const [imageSize, setImageSize] = useState({ width: 960, height: 540 });

  const loadFrame = useCallback(
    async (index: number) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = `${API_URL}/frame/${projectId}/${index}`;
      img.onload = () => {
        const scale = Math.min(960 / img.width, 540 / img.height);
        setCanvasSize({
          width: img.width * scale,
          height: img.height * scale,
        });
        setImageSize({ width: img.width, height: img.height });
        setFrameImage(img);
      };
      setCurrentFrame(index);

      const res = await fetch(`${API_URL}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, frame_index: index }),
      });
      const data = await res.json();
      setDetections(data.objects || []);
    },
    [projectId]
  );

  useEffect(() => {
    fetch(`${API_URL}/project/${projectId}/status`)
      .then((r) => r.json())
      .then((d) => { if (d.frame_count > 0) setFrameCount(d.frame_count); })
      .catch(() => {});
    loadFrame(1);
  }, [loadFrame, projectId]);

  async function handleCanvasClick(e: any) {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const scaleX = imageSize.width / canvasSize.width;
    const scaleY = imageSize.height / canvasSize.height;
    const clickX = Math.round(pos.x * scaleX);
    const clickY = Math.round(pos.y * scaleY);

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
        <h1 className="text-xl font-semibold tracking-tight">FrameShift Editor</h1>
        <span className="font-mono text-xs text-white/30">{projectId}</span>
      </header>

      <main className="flex flex-1 gap-6 p-6">
        {/* Canvas + scrubber */}
        <div className="flex-1 min-w-0">
          <div className="inline-block overflow-hidden rounded-xl border border-white/10">
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
              <label className="block text-xs text-white/40">Target Color</label>
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
