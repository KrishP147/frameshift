# FrameShift AI — Editor Page Design

## Summary

Full-featured video editor page at `/editor/[projectId]`. Hybrid Canva-inspired structure with minimal aesthetic. Slim icon sidebar, max-space canvas with Konva.js overlays, floating contextual edit panel, docked timeline. All UI uses mock data — no backend required.

## Layout

```
┌─────────────────────────────────────────────┐
│ ◆ FrameShift    project.mp4   [Share][Export]│
├─────┬───────────────────────────────────────┤
│     │                                       │
│ ↑   │                                       │
│icon │      VIDEO CANVAS (full focus)        │
│only │      Konva.js overlay for bbox/mask   │
│slim │                                       │
│side │      ┌──────────────┐                 │
│bar  │      │  click object │  ┌───────┐     │
│     │      └──────────────┘  │ Edit  │     │
│ ⬆   │                        │ Panel │     │
│ ○   │     ▶ 0:02 / 0:05     │(float)│     │
│ ✂   │                        └───────┘     │
│ ⬇   │                                       │
├─────┴───────────────────────────────────────┤
│ ◆────────────────────────────────  Timeline  │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░  Frames       │
│ + drag and drop media         [zoom 25%]    │
└─────────────────────────────────────────────┘
```

## Components

### EditorTopBar
- FrameShift logo (links to `/`)
- Editable project name (click to rename)
- Share button (ghost style)
- Export button (coral accent, primary CTA)

### EditorSidebar
- Slim icon-only rail (~60px wide)
- Icons: Upload, Detect, Edit, Settings
- Tooltip on hover showing label
- Active icon gets coral accent highlight
- Clicking icon triggers its action (no expanding sub-panel)

### EditorCanvas
- Takes all remaining space (flex-1)
- Dark background (`#0a0a0a`)
- Video frame centered with aspect ratio preserved
- Konva.js `<Stage>` + `<Layer>` overlay for:
  - Bounding boxes (dashed coral stroke)
  - Selection highlight (coral fill at 20% opacity)
  - Mask overlay (semi-transparent coral)
- Click on canvas object → selects it → opens EditPanel
- Click empty area → deselects → closes EditPanel

### EditPanel
- Floats in from right edge with slide animation
- Width: 320px
- Dark surface background with subtle border
- Three tabs: Recolor | Resize | Replace
- Each tab contains:
  - **Recolor**: Color swatches (8 presets) + hex input + opacity slider
  - **Resize**: Drag slider (0.5x–2.0x) + numeric input
  - **Replace**: Small drop zone for image upload + preview
- "Apply to all frames" toggle switch
- "Apply" button (coral, full-width)
- Close button (X) top-right

### EditorTimeline
- Docked at bottom, ~160px tall
- Playback controls centered: step-back, play/pause, step-forward
- Current time / total time display
- Frame scrubber: horizontal track with draggable coral playhead diamond
- Frame thumbnail strip below scrubber (horizontal scroll)
- Drag-and-drop media prompt: "+ or drag and drop media"
- Zoom slider bottom-right (25%–200%)

## User Flow States

### 1. Empty State
- Canvas shows centered drop zone: dashed border, "Upload a video to start"
- Matches landing page DropZone styling (pulse animation on hover)
- Timeline is empty/disabled

### 2. Video Loaded
- First frame displayed on canvas
- Timeline populates with frame thumbnail strip
- Playback controls become active
- Sidebar "Detect" icon pulses once to guide user

### 3. Detecting Objects
- Shimmer animation overlays the canvas
- Sidebar "Detect" icon shows loading spinner
- After ~1s (mock): bounding boxes appear over detected objects
- Each bbox labeled with class name + confidence

### 4. Object Selected
- Clicked bbox highlights coral (stroke thickens, fill 20% opacity)
- Other bboxes dim to 40% opacity
- EditPanel slides in from right (300ms, ease-out)
- Recolor tab active by default

### 5. Editing Preview
- Recolor: canvas shows tinted overlay on selected region
- Resize: bbox resizes visually with drag handles
- Replace: uploaded image previews inside the bbox area

### 6. Processing
- "Apply" clicked → progress bar appears in timeline area
- Canvas shows frame-by-frame processing animation
- After completion → result frame replaces current view
- Toast notification: "Edit applied to N frames"

### 7. Export
- Export button → modal with options (MP4, resolution)
- Progress bar during render
- Download link when complete

## Design Tokens

All tokens match the landing page design.md:

```css
/* Editor-specific (dark mode) */
--editor-bg: #0a0a0a;
--editor-surface: #111827;
--editor-surface-hover: #1f2937;
--editor-border: #374151;

/* Shared with landing page */
--accent: #f43f5e;
--accent-hover: #e11d48;
--fg: #ffffff;
--fg-muted: #9ca3af;
--fg-subtle: #6b7280;
```

- Font: Clash Display (headings), system sans-serif (UI controls)
- Border radius: 12px (buttons, inputs), 16px (panels, modals)
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for all transitions
- Reduced motion: respects `prefers-reduced-motion`

## Mock Data

### Mock Video
- Static placeholder image (gradient or sample frame)
- 150 frames at 30fps = 5 seconds duration
- Timeline generates 150 thumbnail slots

### Mock Detections
```json
{
  "objects": [
    { "label": "person", "confidence": 0.98, "bbox": [100, 50, 300, 450] },
    { "label": "bottle", "confidence": 0.94, "bbox": [320, 200, 400, 320] },
    { "label": "laptop", "confidence": 0.91, "bbox": [450, 180, 650, 350] }
  ]
}
```

### Mock Edit Response
- Recolor: CSS filter overlay on bbox region
- Resize: transform scale on bbox
- Replace: position uploaded image at bbox coordinates

## Animations

| Animation | Duration | Easing | Trigger |
|-----------|----------|--------|---------|
| EditPanel slide-in | 300ms | cubic-bezier(0.22, 1, 0.36, 1) | Object selected |
| EditPanel slide-out | 200ms | ease-in | Deselect / close |
| Bbox hover | 150ms | ease | Mouse enter bbox |
| Detection shimmer | 1s | linear loop | During detect |
| Progress bar | varies | linear | During processing |
| Toast notification | 400ms in, 300ms out | ease | After apply |
| Drop zone pulse | 1.5s | ease-in-out infinite | Hover on empty state |

## File Structure

```
src/
├── app/
│   └── editor/
│       └── [projectId]/
│           └── page.tsx          # Editor page (client component)
├── components/
│   └── editor/
│       ├── EditorTopBar.tsx
│       ├── EditorSidebar.tsx
│       ├── EditorCanvas.tsx
│       ├── EditPanel.tsx
│       ├── EditorTimeline.tsx
│       ├── TimelinePlayhead.tsx
│       ├── BoundingBox.tsx
│       ├── ColorPicker.tsx
│       ├── ResizeSlider.tsx
│       ├── ReplaceUpload.tsx
│       └── EditorDropZone.tsx
├── hooks/
│   ├── useEditorState.ts         # Central editor state management
│   └── useInView.ts              # Existing hook
└── lib/
    └── mock-data.ts              # Mock detections, frames, etc.
```

## State Management

Single `useEditorState` hook manages all editor state:

```ts
interface EditorState {
  // Video
  videoUrl: string | null;
  frames: string[];           // frame thumbnail URLs
  currentFrame: number;
  isPlaying: boolean;
  duration: number;

  // Detection
  detections: Detection[];
  isDetecting: boolean;
  selectedObjectIndex: number | null;

  // Edit
  editMode: 'recolor' | 'resize' | 'replace' | null;
  editParams: EditParams;
  isProcessing: boolean;
  applyToAllFrames: boolean;

  // UI
  zoom: number;
  showEditPanel: boolean;
}
```

## Accessibility

- All interactive elements keyboard-navigable
- Sidebar icons have aria-labels
- Canvas bboxes focusable with Tab
- Timeline scrubber supports arrow keys
- Reduced motion disables all animations
- Color contrast meets WCAG AA on dark background
