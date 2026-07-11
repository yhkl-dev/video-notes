# Video Notes

A Chrome side-panel extension for creating timestamped, annotated segments of any HTML video element. Take structured notes while watching tutorials, lectures, meetings, or any video content.

## Features

### Video Segment Management

- **Add Segments**: Set start and end times via dropdown selectors, direct text input (`MM:SS` / `HH:MM:SS`), or the interactive timeline bar. Validates time ranges against video duration.
- **Play / Pause**: Play a segment from its start time. Pause resumes from the current position.
- **Reset**: Seek back to the segment start time and replay.
- **Loop Playback**: Per-segment toggle — replay a segment continuously until stopped.
- **Delete**: Remove individual segments.

### Notes (Markdown)

- Full Markdown editing with real-time preview below the editor.
- **Formatting toolbar**: Bold, italic, code block, image insertion.
- **Screenshot Capture**: Capture the current video frame as an image embedded in the note. Canvas-based for same-origin videos, falls back to `captureVisibleTab` for cross-origin (YouTube, etc.).
- **Timestamp Links**: Write `[01:23]` or `[1:02:30]` in notes — rendered as clickable links that seek the video to that timestamp.
- **Note Templates**: Pre-built templates for Summary, Action Items, and Meeting Notes.
- **Image Insertion**: Insert images by URL (validated protocol: `http`, `https`, `data`).

### Organization

- **Tags**: Comma-separated tags per segment, displayed as colored badges. Filter by tag.
- **Search**: Full-text search across notes, time ranges, and tags.
- **Sort Modes**: Newest, Oldest, Start ↑/↓, End ↑/↓, or Custom drag-and-drop reorder.
- **Tag Color Coding**: Segments get a colored left border based on their first tag for visual scanning.

### Batch Operations

- Multi-select with checkboxes, Select All, Clear Selection.
- **Delete Selected** — with undo support.
- **Export JSON** — download selected segments as a `.json` file.
- **Export Markdown** — download selected segments as a formatted `.md` file with timestamps, tags, and notes.
- **Merge Selected** — combine multiple segments into one (earliest start, latest end, merged notes, union of tags).
- **Import** — load segments from a previously exported JSON file (deduplicates by ID).

### Timeline Visualization

- Interactive timeline bar showing all existing segments as colored blocks.
- Current selection highlighted in blue.
- Click to set start time, click again to set end time. Automatic swap if end < start.
- Coverage statistics bar showing the percentage of video duration covered by segments.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause current segment |
| `←` / `→` | Seek backward / forward 5 seconds |
| `Ctrl+Z` / `Cmd+Z` | Undo (delete, merge, import) |
| `Ctrl+Shift+Z` | Redo |

Press `?` in the toolbar to view all shortcuts.

### Undo / Redo

- 50-entry undo stack covering delete, merge, and import operations.
- Keyboard shortcuts or UI buttons.

### History

- List of previously visited video pages stored in browser storage.
- Click to reopen or delete history entries.

### Dark Mode

- Toggle between light and dark themes via the ☀/🌙 button in the header.
- Auto-detects system preference on first launch.
- Persists preference to localStorage.

### Internationalization

- Full bilingual support: English and Chinese (Simplified).
- All user-facing strings are externalized in `locales/`.

## How to Use

1. Install the extension.
2. Open any page with a `<video>` element (YouTube, Bilibili, local files, etc.).
3. Click the extension icon to open the side panel.
4. The extension detects the video and shows its name, duration, and a timeline bar.
5. Click on the timeline bar to set start/end times, then click **Add Time Segment**.
6. Click the edit icon on a segment to add Markdown notes, tags, templates, or capture a screenshot.
7. Use the play/pause/reset buttons to control video playback.
8. Export your notes as Markdown or JSON for sharing or backup.

## Permissions

| Permission | Purpose |
|-----------|---------|
| `sidepanel` | Side panel UI |
| `scripting` | Inject playback control and video detection into pages |
| `activeTab` | Interact with the current tab's video |
| `tabs` | Open and switch between video tabs from history |
| `storage` | Persist segments and video history |
| `<all_urls>` | Detect videos on any website |

## Tech Stack

- [Plasmo](https://docs.plasmo.com/) — Browser Extension Framework
- React 19 + TypeScript 7
- Tailwind CSS 3.4
- Marked (Markdown) + DOMPurify (sanitization)

## Development

```bash
pnpm install
pnpm dev      # Development with hot reload
pnpm build    # Production build
pnpm package  # Package for distribution
```
