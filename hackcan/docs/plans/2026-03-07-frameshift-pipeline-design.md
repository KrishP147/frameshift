# FrameShift AI — Pipeline Design

## Summary

AI-powered video editor. User uploads video, clicks an object, applies an edit (recolor, resize, replace, add, delete), and the edit propagates across the entire video via SAM 2 tracking. Cloudinary handles all image transformations (including generative AI) and video delivery.

## Demo Scope

- 5 edit types: recolor, resize, replace, add, delete — all via Cloudinary
- Multi-frame propagation via SAM 2
- Videos kept short for demo (5-10 sec, 30fps = 150-300 frames)
- Cloudinary performs all per-frame image transformations (including generative AI)
- Pre-computed YOLO detections via BackgroundTasks (run on all frames during extraction)
- Edit rules collected on frontend, sent as batch to backend on render
- 24-48 hour hackathon timeline

---

## Pipeline

```
1. User uploads video
        ↓
        ↓
3. Backend downloads video from Cloudinary URL
        ↓
4. FFmpeg extracts frames at 30fps → saved locally as frame_0001.jpg, frame_0002.jpg, ...
        ↓
5. Upload ALL extracted frames to Cloudinary (each gets a public_id)
        ↓
6. User scrubs to a frame in the frontend
        ↓
7. YOLOv11 detects objects on that frame → bounding boxes shown on canvas
        ↓
8. User clicks an object (bbox or freeclick)
        ↓
9. SAM 2 segments the object on the anchor frame → returns mask
        ↓
10. SAM 2 propagates mask across ALL extracted frames → per-frame masks
        ↓
11. Upload ALL masks to Cloudinary (each gets a public_id)
        ↓
12. User builds edit rules on frontend (can make multiple edits before rendering):
    - Each rule includes start_frame + end_frame range
    - Recolor: target color (hex)
    - Resize: scale factor
    - Replace: text prompt describing replacement (Cloudinary e_gen_replace)
    - Add: text prompt → Cloudinary generates object → user previews/approves → positioned + tracked
    - Delete: select object to remove (Cloudinary e_gen_remove)
        ↓
13. User clicks "Render" → ALL edit rules sent to backend in one batch
        ↓
14. For each edit rule, only process frames within [start_frame, end_frame]:
    - Frames outside range: copy original frame unchanged
    - Frames inside range: apply Cloudinary transformation using frame + mask public_ids:
        - Recolor: e_colorize with mask overlay + target color
        - Resize: c_scale on masked region, overlay back
        - Replace: e_gen_replace with text prompt on masked region
        - Add: l_{asset} overlay positioned at coordinates
        - Delete: e_gen_remove on masked region
    - Download transformed frame
        ↓
15. FFmpeg re-encodes transformed frames in the range or all the framex into final video
        ↓
16. Upload final video to Cloudinary → CDN URL returned
        ↓
17. Frontend plays the edited video from cloudinary
```

---

## System Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Next.js)                      │
│  - Video upload widget (Cloudinary)      │
│  - Frame viewer + scrubber               │
│  - Konva.js canvas (bbox overlays)       │
│  - Edit controls (recolor/resize/replace/ │
│    add/delete)                            │
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
- Uploads all frames to Cloudinary (each gets public_id)
- Runs YOLOv11 on ALL frames in background (via BackgroundTasks)
- Returns immediately: `{ project_id, status: "processing" }`

### GET /project/{project_id}/status
- Returns processing status + all pre-computed YOLO detections when ready
- Returns: `{ status: "ready"|"processing", frame_count, detections: { "1": [...], "2": [...] } }`

### POST /segment
- Input: `{ project_id, frame_index, click_x, click_y }`
- Runs SAM 2 on anchor frame with click point
- Propagates mask across all frames
- Returns: `{ mask_count, anchor_mask_url }`

### POST /edit
- Input: `{ project_id, edit_rules: [...] }`
  - Each rule: `{ object_id, edit_type, start_frame, end_frame, params }`
  - recolor: `{ color: "#FF0000" }`
  - resize: `{ scale: 1.5 }`
  - replace: `{ prompt: "a red sports car" }` (Cloudinary e_gen_replace)
  - add: `{ prompt: "neon sign saying SALE", x, y, w, h }` (generates then overlays)
  - delete: `{}` (Cloudinary e_gen_remove on masked region)
- Only frames within [start_frame, end_frame] are transformed
- Frames outside range are copied unchanged to edited/ dir
- Applies ALL edit rules across all frames using Cloudinary transforms
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
  - Replace: text prompt (e.g. "a red sports car")
  - Add: text prompt → generate object → preview/approve → drag to position
  - Delete: one-click remove
  - Frame range: start/end frame sliders per edit rule
- Edit rules stored locally on frontend (user can make multiple edits)
- "Render" button → sends all edit rules as batch → triggers /edit + /render
- Result video player (edited video from Cloudinary URL)

---

## Cloudinary Transformations

All 5 edit types use Cloudinary's API. SAM 2 provides the mask/region, Cloudinary does the actual edit.

### Recolor
```
e_colorize with mask overlay + target color
```
SAM 2 mask → Cloudinary overlays color on masked pixels

### Resize
```
c_scale on masked region → overlay back onto frame
```
SAM 2 mask bbox → Cloudinary crops, scales, composites back

### Replace (Generative)
```
e_gen_replace, prompt: "a red sports car"
```
SAM 2 mask defines region → Cloudinary AI replaces with prompt-described object

### Add (Generative)
```
e_gen_background_replace or e_gen_replace to generate object from prompt
→ then l_{generated_asset} overlay positioned at x,y with w,h
```
User provides text prompt → Cloudinary generates the object → user previews/approves → overlays at coordinates, tracked across frames

### Delete (Generative)
```
e_gen_remove on masked region
```
SAM 2 mask defines region → Cloudinary AI removes object and fills background

Exact Cloudinary URL syntax will need testing — these are the conceptual transforms.

---

## Edit Type Details

### Recolor
1. SAM 2 mask defines which pixels to recolor
2. Cloudinary applies e_colorize with target color using mask overlay
3. Download result frame

### Resize
1. SAM 2 mask defines object boundary (bbox)
2. Cloudinary crops masked region, scales by factor, overlays back
3. Cloudinary generative fill handles background behind resized object
4. Download result frame

### Replace
1. SAM 2 mask defines object region
2. User provides text prompt (e.g. "a red sports car")
3. Cloudinary e_gen_replace generates new object matching prompt in masked region
4. Download result frame

### Add
1. User provides text prompt describing object to add (e.g. "neon sign saying SALE")
2. Cloudinary generates the object image from prompt
3. User previews generated object — can regenerate if it looks wrong
4. User positions object on frame canvas (drag to set x, y, size)
5. Position + size stored as edit rule
6. Cloudinary overlays approved asset at coordinates per frame
7. SAM 2 tracks position across frames for motion-matched placement
8. Download result frame

### Delete
1. SAM 2 mask defines object to remove
2. Cloudinary e_gen_remove removes object and AI-fills background
3. Download result frame

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
| Cloudinary transforms (only frames in range, 20 concurrent) | 5-30s |
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

1. Supabase auth + project persistence
2. Real-time progress via WebSocket
3. Multiple objects per video
4. Undo/redo edits
5. SAM 2 full video propagation (tracking through motion/occlusion)
