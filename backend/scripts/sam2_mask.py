from pathlib import Path
import numpy as np
from PIL import Image
import torch

# These imports depend on the SAM2 repo structure you installed
# Adjust them if the package path differs in your clone
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent

FRAME_PATH = BASE_DIR / "output" / "frame.jpg"
MASK_PATH = BASE_DIR / "output" / "mask.png"

MODEL_CFG = "sam2_hiera_l.yaml"
CHECKPOINT = str(BASE_DIR / "checkpoints" / "sam2_hiera_large.pt")

device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")

image = np.array(Image.open(FRAME_PATH).convert("RGB"))

model = build_sam2(MODEL_CFG, CHECKPOINT, device=device)
predictor = SAM2ImagePredictor(model)
predictor.set_image(image)

# Hardcoded click point
input_point = np.array([[320, 200]])
input_label = np.array([1])  # 1 means foreground

masks, scores, logits = predictor.predict(
    point_coords=input_point,
    point_labels=input_label,
    multimask_output=True,
)

best_mask = masks[np.argmax(scores)]

mask_img = (best_mask * 255).astype(np.uint8)
Image.fromarray(mask_img).save(MASK_PATH)

print(f"Saved mask to {MASK_PATH}")