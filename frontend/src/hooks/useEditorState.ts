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
  videoLoaded: boolean;
  videoName: string;
  duration: number;
  fps: number;
  frames: FrameData[];
  currentFrame: number;
  isPlaying: boolean;
  detections: Detection[];
  isDetecting: boolean;
  selectedObjectId: string | null;
  editMode: EditMode | null;
  editParams: EditParams;
  isProcessing: boolean;
  applyToAllFrames: boolean;
  zoom: number;
  showEditPanel: boolean;
  toastMessage: string;
  showToast: boolean;
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
    toastMessage: "",
    showToast: false,
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
        showToast: true,
        toastMessage: `Edit applied to ${s.applyToAllFrames ? "all 150 frames" : "current frame"}`,
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

  const hideToast = useCallback(() => {
    setState((s) => ({ ...s, showToast: false }));
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
    hideToast,
  };
}
