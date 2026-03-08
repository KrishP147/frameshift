# Thumbnail Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Set Thumbnail" button to each project card that picks a random frame and saves it as the project thumbnail.

**Architecture:** Client-side only. On button click, fetch project status to get `frame_count`, pick a random index, construct the FastAPI frame URL, PATCH Supabase via the existing Next.js API route, and optimistically update local state.

**Tech Stack:** Next.js 15, React, Tailwind CSS, FastAPI (read-only), Supabase (via existing PATCH route)

---

### Task 1: Add thumbnail state and "Set Thumbnail" button to ProjectCard

**Files:**
- Modify: `frontend/src/components/dashboard/ProjectCard.tsx`

**Step 1: Read the current file**

Open `frontend/src/components/dashboard/ProjectCard.tsx` and confirm the existing structure (ProjectCard function, hover buttons, thumbnail img/placeholder).

**Step 2: Add local thumbnail state and loading state**

Inside `ProjectCard`, after the existing `const [deleting, setDeleting]` line, add:

```tsx
const [thumbnailUrl, setThumbnailUrl] = useState(project.thumbnail_url ?? "");
const [settingThumbnail, setSettingThumbnail] = useState(false);
```

**Step 3: Add the handleSetThumbnail function**

Add this function after `handleDelete`:

```tsx
async function handleSetThumbnail(e: React.MouseEvent) {
  e.stopPropagation();
  if (settingThumbnail) return;
  setSettingThumbnail(true);

  try {
    // Get frame_count from status
    const statusRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/project/${project.project_id}/status`
    );
    if (!statusRes.ok) return;
    const { frame_count, status: projectStatus } = await statusRes.json();

    if (!frame_count || !["ready", "done"].includes(projectStatus)) return;

    const randomIndex = Math.floor(Math.random() * frame_count);
    const url = `${process.env.NEXT_PUBLIC_API_URL}/frame/${project.project_id}/${randomIndex}`;

    // Optimistically update UI
    setThumbnailUrl(url);

    // Persist to DB
    await fetch(`/api/projects/${project.project_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnail_url: url }),
    });
  } catch {
    // silently fail — thumbnail just won't update
  } finally {
    setSettingThumbnail(false);
  }
}
```

**Step 4: Replace thumbnail_url usage in JSX with local state**

Find this line in the JSX:
```tsx
{project.thumbnail_url ? (
  <img
    src={project.thumbnail_url}
```

Replace with:
```tsx
{thumbnailUrl ? (
  <img
    src={thumbnailUrl}
```

**Step 5: Add the "Set Thumbnail" button next to the delete button**

Find the delete `<button>` block (the trash icon button). Add the "Set Thumbnail" button immediately before it:

```tsx
<button
  onClick={handleSetThumbnail}
  disabled={settingThumbnail}
  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9CA3AF] hover:text-[#F43F5E] text-xs p-1 -mt-0.5 flex-shrink-0"
  title="Set random thumbnail"
>
  {settingThumbnail ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )}
</button>
```

**Step 6: Verify the full component renders without TypeScript errors**

Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

**Step 7: Manually test in browser**

1. Start dev server: `cd frontend && npm run dev`
2. Go to `/dashboard`
3. Hover a project card that has status `ready` or `done`
4. Click the image/thumbnail icon button
5. Confirm: spinner appears briefly, then thumbnail updates to a video frame
6. Refresh page — confirm thumbnail persists (loaded from DB)

**Step 8: Commit**

```bash
git add frontend/src/components/dashboard/ProjectCard.tsx
git commit -m "feat: add set random thumbnail button to project cards"
```
