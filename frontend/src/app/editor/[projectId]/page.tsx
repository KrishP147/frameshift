"use client";

import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditPanel } from "@/components/editor/EditPanel";
import { EditorTimeline } from "@/components/editor/EditorTimeline";
import { Toast } from "@/components/editor/Toast";
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
      <EditorTopBar
        videoName={editor.videoName}
        onNameChange={editor.setVideoName}
        videoLoaded={editor.videoLoaded}
      />

      <div className="flex-1 flex overflow-hidden">
        <EditorSidebar
          videoLoaded={editor.videoLoaded}
          isDetecting={editor.isDetecting}
          onUpload={editor.loadVideo}
          onDetect={editor.detectObjects}
          onEditClick={() => {}}
        />

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

      <Toast
        message={editor.toastMessage}
        show={editor.showToast}
        onHide={editor.hideToast}
      />
    </div>
  );
}
