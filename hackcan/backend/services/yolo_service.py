import torch
from ultralytics import YOLO
from pathlib import Path

_model = None

def get_model():
    global _model
    if _model is None:
        _model = YOLO("yolo11n.pt")
    return _model

def detect(frame_path: Path) -> list:
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = get_model()
    results = model(str(frame_path), device=device, conf=0.45, iou=0.4, imgsz=1280)

    detections = []
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            detections.append({
                "label": r.names[int(box.cls[0].item())],
                "confidence": round(float(box.conf[0].item()), 4),
                "bbox": [round(v, 2) for v in box.xyxy[0].tolist()],
            })
    return detections
