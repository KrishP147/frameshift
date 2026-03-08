# Thumbnail Generator — Design Doc
Date: 2026-03-08

## Summary
Add a "Set Thumbnail" button to each project card in the dashboard. Clicking it picks a random frame from the project's extracted frames and saves the URL as the project thumbnail via a Supabase PATCH.

## Approach
Client-side random frame selection using already-uploaded Cloudinary frame URLs. No new backend endpoints required.

## Data Flow
1. User hovers a ProjectCard → "Set Thumbnail" button appears (alongside existing delete button)
2. On click:
   - Fetch `GET /api/projects/{projectId}/status` to retrieve `frame_count`
   - Pick `Math.floor(Math.random() * frame_count)` as the frame index
   - Construct frame URL: `{BACKEND_URL}/frame/{projectId}/{index}`
   - Call `PATCH /api/projects/{projectId}` with `{ thumbnail_url }`
   - Optimistically update local `project.thumbnail_url` state in `ProjectCard`
3. Card re-renders immediately with the new thumbnail image

## Components

### Modified
- `frontend/src/components/dashboard/ProjectCard.tsx`
  - Add "Set Thumbnail" icon button (visible on hover, next to delete)
  - Add `thumbnailUrl` local state initialized from `project.thumbnail_url`
  - Add `settingThumbnail` loading boolean
  - Guard: skip if `frame_count === 0` or status not in `['ready', 'done']`

### New
- `frontend/src/app/api/projects/[projectId]/route.ts`
  - Add `PATCH` handler: reads `thumbnail_url` from body, updates Supabase `projects` row, returns updated project
  - (DELETE handler may already exist here — add PATCH alongside it)

## Error Handling
- If status fetch fails or `frame_count` is 0: silently no-op (button does nothing)
- PATCH failure: revert optimistic update, log error to console

## Out of Scope
- Frame scrubber / manual frame selection
- Cloudinary transformation overlays on the thumbnail
