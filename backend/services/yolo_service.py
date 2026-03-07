import torch
from ultralytics import YOLO
from pathlib import Path
from PIL import Image

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

    img = Image.open(frame_path)
    img_w, img_h = img.size

    detections = []
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            # Convert to [x%, y%, width%, height%] percentages
            detections.append({
                "label": r.names[int(box.cls[0].item())],
                "confidence": round(float(box.conf[0].item()), 4),
                "bbox": [
                    round(x1 / img_w * 100, 2),
                    round(y1 / img_h * 100, 2),
                    round((x2 - x1) / img_w * 100, 2),
                    round((y2 - y1) / img_h * 100, 2),
                ],
            })
    return detections
