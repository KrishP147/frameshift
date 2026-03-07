from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="FrameShift AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze-frame")
async def analyze_frame(file: UploadFile = File(...)):
    """Run YOLOv8 object detection on a single frame."""
    from ultralytics import YOLO

    import tempfile
    import os

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        model = YOLO("yolov8n.pt")
        results = model(tmp_path)
        detections = []
        for r in results:
            for box in r.boxes:
                detections.append({
                    "label": r.names[int(box.cls[0])],
                    "confidence": float(box.conf[0]),
                    "bbox": box.xyxy[0].tolist(),
                })
        return {"objects": detections}
    finally:
        os.unlink(tmp_path)


@app.post("/segment")
async def segment_frame(frame_id: str, x: int, y: int):
    """Run SAM 2 segmentation at a point. Placeholder for SAM 2 integration."""
    return {
        "frame_id": frame_id,
        "point": [x, y],
        "mask": "TODO: integrate SAM 2",
    }


@app.post("/render")
async def render_video(background_tasks: BackgroundTasks):
    """Trigger FFmpeg render. Placeholder for video processing pipeline."""
    return {"status": "TODO: implement FFmpeg render pipeline"}
