# FrameShift AI — Pipeline Design

## Summary

AI-powered video editor. User uploads video, clicks an object, applies an edit (recolor, resize, replace), and the edit propagates across the entire video via SAM 2 tracking. Cloudinary handles image transformations and video delivery.

## Demo Scope

- 3 edit types: recolor, resize, replace (remove is stretch goal)
- Multi-frame propagation via SAM 2
- Videos kept short for demo (5-10 sec, 30fps = 150-300 frames)
- Cloudinary performs per-frame image transformations
- 24-48 hour hackathon timeline

---

## Pipeline

```
1. User uploads video
        ↓
2. Video stored in Cloudinary (returns public_id + URL)
        ↓
3. Backend downloads video from Cloudinary URL
        ↓
4. FFmpeg extracts frames at 30fps → saved locally as frame_0001.jpg, frame_0002.jpg, ...
        ↓
5. User scrubs to a frame in the frontend
        ↓
6. YOLOv11 detects objects on that frame → bounding boxes shown on canvas
        ↓
7. User clicks an object (bbox or freeclick)
        ↓
8. SAM 2 segments the object on the anchor frame → returns mask
        ↓
9. SAM 2 propagates mask across ALL extracted frames → per-frame masks
        ↓
10. User selects edit type + parameters:
    - Recolor: target color (hex)
    - Resize: scale factor
    - Replace: new image asset
        ↓
11. For each frame:
    - Upload frame + mask to Cloudinary
    - Apply Cloudinary transformation:
        - Recolor: overlay mask with e_colorize or color blend
        - Resize: c_scale on masked region, overlay back
        - Replace: l_{new_asset} overlay positioned by mask bbox
    - Download transformed frame
        ↓
12. FFmpeg re-encodes transformed frames into final video
        ↓
13. Upload final video to Cloudinary → CDN URL returned
        ↓
14. Frontend plays the edited video
```

---

## System Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Next.js)                      │
│  - Video upload widget (Cloudinary)      │
│  - Frame viewer + scrubber               │
│  - Konva.js canvas (bbox overlays)       │
│  - Edit controls (recolor/resize/replace)│
└──────────────┬──────────────────────────┘
               │
        ┌──────▼──────┐
        │ FastAPI API  │
        │              │
        │ /upload      │ → Cloudinary upload
        │ /extract     │ → FFmpeg frame extraction
        │ /detect      │ → YOLOv11
        │ /segment     │ → SAM 2 mask + propagation
        │ /edit        │ → Cloudinary transforms per frame
        │ /render      │ → FFmpeg re-encode + Cloudinary upload
        └──────┬───────┘
               │
     ┌─────────┼──────────┐
     │         │          │
┌────▼───┐ ┌──▼────┐ ┌───▼──────┐
│YOLOv11 │ │SAM 2  │ │Cloudinary│
│        │ │       │ │          │
│Detect  │ │Segment│ │Transform │
│Objects │ │+Track │ │+ Store   │
└────────┘ └───────┘ │+ Deliver │
                      └──────────┘
```

---

## API Endpoints

### POST /upload
- Frontend sends video file (or Cloudinary widget handles direct upload)
- Backend receives Cloudinary public_id + URL
- Returns: `{ project_id, video_url, public_id }`

### POST /extract
- Input: `{ project_id }`
- Downloads video from Cloudinary URL
- FFmpeg extracts frames at 30fps
- Returns: `{ frame_count, frames_dir }`

### POST /detect
- Input: `{ project_id, frame_index }`
- Runs YOLOv11 on the specified frame
- Returns: `{ objects: [{ label, confidence, bbox }] }`

### POST /segment
- Input: `{ project_id, frame_index, click_x, click_y }`
- Runs SAM 2 on anchor frame with click point
- Propagates mask across all frames
- Returns: `{ mask_count, anchor_mask_url }`

### POST /edit
- Input: `{ project_id, edit_type, edit_params }`
  - recolor: `{ color: "#FF0000" }`
  - resize: `{ scale: 1.5 }`
  - replace: `{ asset_public_id: "new_logo" }`
- For each frame: upload frame+mask to Cloudinary, apply transform, download result
- Parallel requests (20 concurrent) to keep it fast
- Returns: `{ edited_frame_count, status }`

### POST /render
- Input: `{ project_id }`
- FFmpeg encodes edited frames into video
- Uploads final video to Cloudinary
- Returns: `{ video_url, cloudinary_public_id }`

---

## Frontend Pages

### / (Landing)
- Upload video button (Cloudinary upload widget)
- Redirects to /editor/:project_id after upload

### /editor/:project_id
- Video player (original video from Cloudinary URL)
- Frame scrubber (slider to pick frame)
- Konva.js canvas overlay showing:
  - YOLO bounding boxes (auto-detected)
  - SAM 2 mask highlight (after click)
- Edit panel:
  - Recolor: color picker
  - Resize: slider (0.5x - 2x)
  - Replace: image upload / asset picker
- "Apply Edit" button → triggers /edit + /render
- Result video player (edited video from Cloudinary URL)

---

## Cloudinary Transformations

### Recolor
Upload frame + mask. Use overlay with opacity and color blend:
```
/image/upload/l_mask_id,e_colorize,co_rgb:FF0000,o_60/frame_id
```

### Resize
Extract masked region, scale it, overlay back onto frame:
```
/image/upload/l_object_id,c_scale,w_1.5/frame_id
```

### Replace
Overlay new asset positioned at mask bounding box:
```
/image/upload/l_new_asset,w_bbox_w,h_bbox_h,x_bbox_x,y_bbox_y/frame_id
```

Exact Cloudinary URL syntax will need testing — these are the conceptual transforms.

---

## Edit Type Details

### Recolor
1. SAM 2 mask defines which pixels to recolor
2. Upload frame to Cloudinary
3. Upload mask as overlay
4. Apply e_colorize with target color on masked region
5. Download result frame

### Resize
1. SAM 2 mask defines object boundary
2. Extract object using mask (crop to bbox)
3. Upload object + frame to Cloudinary
4. Scale object by factor
5. Overlay scaled object back at original position
6. Background behind object needs fill (use surrounding pixels or simple stretch)
7. Download result frame

### Replace
1. SAM 2 mask defines object boundary + bbox
2. User provides replacement image asset
3. Upload frame + new asset to Cloudinary
4. Overlay new asset at mask bbox position, sized to bbox
5. Download result frame

---

## Data Flow Per Project

```
/tmp/frameshift/{project_id}/
├── original.mp4          ← downloaded from Cloudinary
├── frames/               ← extracted at 30fps
│   ├── frame_0001.jpg
│   ├── frame_0002.jpg
│   └── ...
├── masks/                ← SAM 2 output
│   ├── mask_0001.png
│   ├── mask_0002.png
│   └── ...
├── edited/               ← downloaded from Cloudinary after transform
│   ├── frame_0001.jpg
│   ├── frame_0002.jpg
│   └── ...
└── output.mp4            ← FFmpeg re-encoded final video
```

---

## Performance Budget (5-sec video at 30fps = 150 frames)

| Step | Estimated Time |
|------|---------------|
| Upload to Cloudinary | 2-5s |
| FFmpeg extract frames | 1-2s |
| YOLOv11 detect | <1s |
| SAM 2 segment + propagate | 10-30s |
| Cloudinary transforms (150 frames, 20 concurrent) | 15-30s |
| FFmpeg re-encode | 2-5s |
| Upload final to Cloudinary | 2-5s |
| **Total** | **~30-75s** |

Acceptable for a hackathon demo. Show a progress bar on the frontend.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, React, TypeScript, Tailwind, Konva.js |
| Backend | Python, FastAPI, Uvicorn |
| AI - Detection | YOLOv11 (ultralytics) |
| AI - Segmentation | SAM 2 (Meta) |
| Video Processing | FFmpeg |
| Media Platform | Cloudinary (upload, transform, CDN) |
| Auth + DB | Supabase (stretch goal) |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |

---

## Stretch Goals (if time permits)

1. Remove edit type (requires inpainting — use Cloudinary generative fill or local model)
2. Supabase auth + project persistence
3. Real-time progress via WebSocket
4. Multiple objects per video
5. Undo/redo edits
