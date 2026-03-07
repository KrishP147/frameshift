# FrameShift AI — Tech Stack Reference

## Hackathon Stack Overview

```
Frontend:   Next.js + Tailwind + Konva.js
Backend:    FastAPI (single server, no queue)
AI:         SAM 2 + YOLOv8
Video:      FFmpeg (synchronous subprocess)
Media:      Cloudinary (free tier)
Database:   Supabase (free tier)
Hosting:    Vercel (frontend) + Railway (backend)
```

---

## Frontend

### Next.js

Next.js is a React framework built for production.

It handles routing, server-side rendering, and API calls out of the box. For FrameShift, the most important feature is the App Router, which gives you file-based routing and React Server Components — meaning heavy data fetching happens on the server, not the browser.

Why it matters here: Your editor page is complex. Next.js lets you load video metadata, user session, and project data server-side before the page even renders. The user never sees a loading skeleton for critical data.

**Key features you will use:**
- `app/` directory routing
- Server Actions for calling your FastAPI backend
- API routes for lightweight webhook handlers (e.g. Cloudinary upload callbacks)
- Image optimization via `next/image`

---

### Tailwind CSS

Tailwind is a utility-first CSS framework. Instead of writing `.btn { padding: 8px 16px; }` in a stylesheet, you write `className="px-4 py-2"` directly on the element.

For a hackathon this is critical — you ship UI 3x faster because you never context-switch between files. Every style is co-located with the component it styles.

**Key features you will use:**
- Responsive utilities (`md:`, `lg:`) for layout breakpoints
- Dark mode support via `dark:` prefix
- `@apply` for extracting repeated patterns into reusable classes

---

### Konva.js

Konva is a canvas library for React. It lets you draw shapes, images, and interactive overlays on top of a `<canvas>` element using a React-style component API.

This is what powers your frame editor — the layer where users click objects, see bounding boxes, drag handles, and selection masks.

**Why not just a `<div>` overlay?** Canvas gives you pixel-level precision, hit detection on arbitrary shapes (not just rectangles), and the ability to render segmentation masks returned from SAM 2.

**Key features you will use:**
- `<Stage>` and `<Layer>` for the canvas container
- `<Rect>` and `<Line>` for bounding boxes
- `<Image>` for rendering the current video frame as a static image
- `<Transformer>` for resize/rotate handles on selected objects
- Mouse event handlers (`onClick`, `onDragEnd`) for user interaction

---

## Backend

### FastAPI

FastAPI is a modern Python web framework. It is fast (built on Starlette and Uvicorn), generates automatic API documentation, and has native support for async — critical when you are waiting on subprocess calls to FFmpeg or HTTP calls to AI model endpoints.

For a hackathon, the single-server model means you run everything in one process: auth, video jobs, AI orchestration, and streaming responses. No separate worker process, no message broker. A job comes in, the server processes it synchronously, and returns the result.

**Key features you will use:**
- `@app.post("/analyze-frame")` route for running YOLOv8 on a frame
- `@app.post("/segment")` route for running SAM 2
- `@app.post("/render")` route for triggering FFmpeg
- Background tasks via `BackgroundTasks` for fire-and-forget jobs
- Pydantic models for request/response validation

**Example route:**
```python
@app.post("/segment")
async def segment_frame(frame_id: str, x: int, y: int):
    mask = sam2_model.predict(frame_id, point=(x, y))
    return {"mask": mask.tolist(), "frame_id": frame_id}
```

---

## AI

### YOLOv8

YOLO (You Only Look Once) is an object detection model. Given a single image frame, it returns a list of detected objects — each with a class label, confidence score, and bounding box coordinates.

In FrameShift, YOLOv8 runs when a user uploads a video and selects a frame. It pre-populates the editor with detected objects so users can click-to-select instead of drawing boxes manually.

**What it outputs:**
```json
{
  "objects": [
    { "label": "bottle", "confidence": 0.94, "bbox": [320, 200, 80, 120] },
    { "label": "person", "confidence": 0.98, "bbox": [100, 50, 200, 400] }
  ]
}
```

**Why YOLOv8 specifically:** It runs in real-time on a CPU, has excellent pretrained weights for common objects, and integrates in 5 lines of Python via the `ultralytics` library.

```python
from ultralytics import YOLO
model = YOLO("yolov8n.pt")
results = model("frame.jpg")
```

---

### SAM 2

SAM 2 (Segment Anything Model 2) is Meta's video segmentation model. This is the core of FrameShift.

SAM 2 takes a point or bounding box on a frame as input, and returns a precise pixel-level mask for the object — and then tracks that mask forward and backward across video frames.

**This is exactly your use case.** The user clicks a bottle. SAM 2 segments the bottle with a pixel mask. You now know exactly which pixels are the bottle in every frame.

**What it outputs:**
- A segmentation mask (binary image, same size as frame)
- Tracked mask positions across N frames

**Why SAM 2 over SAM 1:** SAM 1 is image-only. SAM 2 was built specifically for video — it has a memory module that maintains object identity across frames even through occlusion and camera motion.

```python
from sam2.build_sam import build_sam2_video_predictor
predictor = build_sam2_video_predictor(model_cfg, checkpoint)
predictor.add_new_points(frame_idx=0, obj_id=1, points=[[320, 200]])
masks = predictor.propagate_in_video()
```

---

## Video Processing

### FFmpeg

FFmpeg is the industry-standard command-line tool for video processing. It handles encoding, decoding, frame extraction, compositing, format conversion, and streaming.

In FrameShift, FFmpeg does the actual frame-level editing — applying the transformations defined by the user across every frame of the video.

**Key operations:**
- Extract frames as images: `ffmpeg -i video.mp4 frame_%04d.jpg`
- Overlay a modified region: `ffmpeg -i video.mp4 -i overlay.png -filter_complex overlay=x:y output.mp4`
- Encode final output: `ffmpeg -i frames/%04d.jpg -c:v h264 output.mp4`
- Hardware acceleration: `-c:v h264_nvenc` (NVIDIA) or `-c:v h264_videotoolbox` (Mac)

**Why subprocess calls are fine for a hackathon:** You call FFmpeg from Python using `subprocess.run()`. It blocks until the job is done, then you return the result. For a 30-second demo clip this takes seconds. No queue needed.

```python
import subprocess
subprocess.run([
    "ffmpeg", "-i", input_path,
    "-vf", f"overlay={x}:{y}",
    output_path
], check=True)
```

---

## Media

### Cloudinary

Cloudinary is a cloud media platform that handles upload, storage, transformation, and delivery of images and video.

For FrameShift, Cloudinary replaces what would otherwise be S3 + Lambda + CloudFront — all three in one service, with a generous free tier.

**What you use it for:**
- Accepting video uploads directly from the browser (no file hits your server)
- Storing raw video and processed outputs
- Delivering video via CDN with auto-format optimization
- On-the-fly transformations for thumbnails and previews

**Key features:**
- Upload widget: drop-in React component for browser-side uploads
- Signed uploads: secure upload tokens generated by your backend
- Video transformations via URL parameters: `c_scale,w_720` resizes on delivery
- Webhooks: notifies your backend when upload processing is complete

The free tier includes 25 credits/month — enough to process dozens of videos.

---

## Database

### Supabase

Supabase is an open-source Firebase alternative. It provides PostgreSQL, authentication, file storage, and realtime subscriptions as a managed service.

For FrameShift, Supabase handles:

**Auth:** Email/password and OAuth (Google, GitHub) out of the box. Returns a JWT your FastAPI backend validates.

**Database:** PostgreSQL for storing projects, frame edits, tracking maps, and job status.

**Realtime:** WebSocket subscriptions so your frontend can listen for job completion without polling. When FFmpeg finishes, update the `jobs` table — the frontend receives the update instantly.

**Key tables:**
```sql
users         -- managed by Supabase Auth
projects      -- video projects per user
frame_edits   -- edit rules per frame per object
jobs          -- processing job status (pending/processing/done)
outputs       -- final rendered video Cloudinary URLs
```

The free tier includes 500MB database, 1GB file storage, and 50,000 monthly active users.

---

## Hosting

### Vercel (Frontend)

Vercel is the company that built Next.js, and their hosting platform is purpose-built for it.

You connect your GitHub repo and every push to `main` automatically deploys. Zero configuration.

**What you get for free:**
- Global CDN with edge caching
- Automatic HTTPS
- Preview deployments for every PR
- Environment variable management
- Built-in analytics

For a hackathon, Vercel means your frontend is live in 2 minutes.

---

### Railway (Backend)

Railway is a platform-as-a-service for deploying Docker containers and Python apps.

You connect your GitHub repo, Railway detects it's a Python/FastAPI app, and deploys it automatically. One environment variable for your port, and you are live.

**Why Railway over Render for this project:**
- Faster cold starts
- Better support for GPU workloads if you later need them
- Simpler environment variable management
- Persistent disk for temporary file storage during FFmpeg jobs

Free tier includes $5 of usage per month — enough for a hackathon.

---

---

# Production Upgrades

When FrameShift moves beyond a hackathon, the following upgrades apply at each layer.

---

## Replace Synchronous Jobs → Celery + Redis

**The problem with synchronous processing:**

In the hackathon version, when a user submits a video, FastAPI blocks until FFmpeg finishes. If that takes 3 minutes, the HTTP connection stays open for 3 minutes. Two concurrent users will queue. Ten concurrent users will time out.

**The fix: Celery + Redis**

Celery is a distributed task queue. Instead of running FFmpeg inside the request, you dispatch a job to a Celery worker and return a job ID immediately.

Redis acts as the message broker — it holds the job queue and communicates job status between FastAPI and the workers.

```
User submits video
       ↓
FastAPI creates job → returns { job_id: "abc123" }
       ↓
Celery worker picks up job
       ↓
Worker runs FFmpeg
       ↓
Worker updates job status in Redis/DB
       ↓
Frontend polls or subscribes for completion
```

**Benefits:**
- Non-blocking API responses
- Multiple workers process jobs in parallel
- Failed jobs auto-retry
- Job priority queues (paid users skip the queue)
- Worker scaling independent of API scaling

---

## Replace Single Server → Kubernetes (K8s)

**The problem with a single Railway server:**

One server handles all traffic. If it crashes, everything is down. If you get featured on Product Hunt and 500 users sign up, your single server is overwhelmed.

**The fix: Kubernetes**

Kubernetes is a container orchestration platform. It runs multiple instances of your services and automatically scales them based on load.

**Key concepts for FrameShift:**

**Deployments** — Run 3 replicas of your FastAPI server. If one crashes, the other two keep serving traffic. Kubernetes restarts the crashed pod automatically.

**Horizontal Pod Autoscaler** — When CPU usage spikes above 70%, Kubernetes automatically adds more FastAPI pods. When load drops, it scales back down.

**Separate worker nodes** — GPU workloads (SAM 2, YOLOv8) run on GPU-enabled node pools, separate from your API servers. You pay for GPU compute only when jobs are running.

**Architecture with K8s:**
```
                    Load Balancer
                         ↓
              ┌──────────┴──────────┐
         FastAPI Pod 1         FastAPI Pod 2
              └──────────┬──────────┘
                         ↓
                    Redis (job queue)
                         ↓
              ┌──────────┴──────────┐
         Celery Worker 1    Celery Worker 2
         (CPU node)         (GPU node)
```

---

## Replace Replicate API Calls → Modal (GPU Workers)

**The problem with calling external AI APIs:**

Replicate charges per inference. At scale, calling SAM 2 via API becomes expensive and introduces latency you cannot control.

**The fix: Modal**

Modal is a platform for running Python functions on cloud GPUs. You write normal Python, decorate it with `@modal.function(gpu="A10G")`, and Modal handles provisioning, scaling, and billing per second of GPU use.

**Benefits over Kubernetes for AI workloads:**
- No idle GPU costs (pay only when running inference)
- Scales to zero between jobs
- Scales to hundreds of GPUs during spikes
- No cluster management

```python
import modal

app = modal.App()

@app.function(gpu="A10G", image=modal.Image.debian_slim().pip_install("ultralytics"))
def run_yolo(frame_bytes: bytes):
    from ultralytics import YOLO
    model = YOLO("yolov8n.pt")
    return model(frame_bytes)
```

---

## Replace Supabase Realtime → WebSocket Server

For high-volume job status updates, Supabase Realtime hits connection limits on the free and pro tiers.

The upgrade is a dedicated WebSocket server (FastAPI WebSockets or a separate Socket.io service) that pushes job updates directly to connected clients.

---

## Add CDN Layer → CloudFront

Cloudinary's CDN is good but not customizable. For large-scale video delivery, adding AWS CloudFront in front of your S3 outputs gives you:

- Custom cache-control headers per asset
- Signed URLs for access-controlled video delivery
- Edge locations optimized for your user geography
- Significantly lower egress costs at volume

---

## Upgrade Summary Table

| Component | Hackathon | Production |
|---|---|---|
| Job processing | Synchronous FastAPI | Celery + Redis |
| Container orchestration | Single Railway server | Kubernetes |
| AI inference | Replicate API / local | Modal GPU workers |
| Realtime updates | Supabase Realtime | Dedicated WebSocket server |
| Video CDN | Cloudinary | CloudFront + S3 |
| Database | Supabase free tier | Supabase Pro or RDS |
| Monitoring | None | Datadog / Grafana + Prometheus |
| Secrets management | .env file | AWS Secrets Manager / Vault |

---

*The hackathon stack gets you to demo. The production stack gets you to scale.*