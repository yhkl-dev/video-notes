import type { ChangeEvent, DragEvent } from "react"

import NoteToolbar from "~components/note-toolbar"
import type { VideoSlice } from "~types"

interface SliceCardProps {
  slice: VideoSlice
  isDragMode: boolean
  isDragOver: boolean
  isSelected: boolean
  isLooping: boolean
  borderColor: string
  durationText: string
  sortMode: string
  noteTemplates: Array<{ key: string; label: string; snippet: string }>
  onToggleSelect: () => void
  onPlayPause: () => void
  onReset: () => void
  onToggleLoop: () => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: (e: DragEvent<HTMLLIElement>) => void
  onDrop: (e: DragEvent<HTMLLIElement>) => void
  onDragEnd: () => void
  onToggleEdit: () => void
  onSave: () => void
  onNoteChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onTagsChange: (value: string) => void
  onAppendNote: (text: string) => void
  onInsertImage: () => void
  onCaptureFrame: () => void
  onInsertTemplate: (e: ChangeEvent<HTMLSelectElement>) => void
  onTimestampClick: (seconds: number) => void
  renderMarkdown: (text: string) => string
}

export default function SliceCard({
  slice,
  isDragMode,
  isDragOver,
  isSelected,
  isLooping,
  borderColor,
  durationText,
  sortMode,
  noteTemplates,
  onToggleSelect,
  onPlayPause,
  onReset,
  onToggleLoop,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleEdit,
  onSave,
  onNoteChange,
  onTagsChange,
  onAppendNote,
  onInsertImage,
  onCaptureFrame,
  onInsertTemplate,
  onTimestampClick,
  renderMarkdown
}: SliceCardProps) {
  return (
    <li
      className={`group flex flex-col p-3.5 mb-2 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-200 border-l-[3px] ${borderColor} ${
        isDragMode ? "cursor-move" : ""
      } ${isDragOver ? "ring-2 ring-blue-400 shadow-md" : ""} ${
        slice.isPlaying
          ? "ring-1 ring-blue-300/50 dark:ring-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)] animate-pulse"
          : ""
      }`}
      draggable={isDragMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
          />
          <div>
            <span className="dark:text-gray-200">
              {slice.startTimeInput} - {slice.endTimeInput}
            </span>
            <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">
              {durationText}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={onPlayPause}
            title={slice.isPlaying ? "Pause" : "Play"}>
            {slice.isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={onReset}
            title="Reset">
            ↺
          </button>
          <button
            className={`p-1.5 rounded-lg transition-colors ${
              isLooping
                ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30"
                : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
            }`}
            onClick={onToggleLoop}
            title={chrome.i18n.getMessage("loopToggle")}>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors text-gray-400"
            onClick={onRemove}
            title="Remove">
            ✕
          </button>
        </div>
      </div>
      {slice.editing ? (
        <>
          <NoteToolbar
            sliceId={slice.id}
            templates={noteTemplates}
            onAppend={(id, text) => onAppendNote(text)}
            onInsertImage={() => onInsertImage()}
            onCaptureFrame={() => onCaptureFrame()}
            onInsertTemplate={(e) => onInsertTemplate(e)}
          />
          <textarea
            className="mt-2 p-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg transition-shadow duration-300 ease-in-out focus:border-blue-400 focus:ring focus:ring-blue-300 focus:ring-opacity-50 w-full"
            value={slice.note || ""}
            onChange={onNoteChange}
            rows={4}
          />
          {slice.note && slice.note.trim() && (
            <div className="mt-1 px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/30 text-[13px] opacity-75">
              <div
                className="markdown-preview dark:text-gray-200"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(slice.note)
                }}
                onClick={(e) => {
                  const target = e.target as HTMLElement
                  if (target.classList.contains("timestamp-link")) {
                    const ts = target.getAttribute("data-timestamp")
                    if (ts) onTimestampClick(Number(ts))
                  }
                }}
              />
            </div>
          )}
        </>
      ) : slice.note && slice.note.trim() ? (
        <div
          className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow markdown-preview text-sm dark:text-gray-200"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(slice.note)
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (target.classList.contains("timestamp-link")) {
              const ts = target.getAttribute("data-timestamp")
              if (ts) onTimestampClick(Number(ts))
            }
          }}
        />
      ) : (
        <p className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow text-sm text-gray-500 dark:text-gray-400">
          {chrome.i18n.getMessage("noNotes")}
        </p>
      )}
      {slice.editing ? (
        <input
          type="text"
          className="mt-2 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          placeholder={chrome.i18n.getMessage("tagsPlaceholder")}
          value={(slice.tags || []).join(", ")}
          onChange={(e) => onTagsChange(e.target.value)}
        />
      ) : slice.tags && slice.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {slice.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex justify-end mt-2 gap-1">
        <button
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          onClick={onToggleEdit}>
          {slice.editing ? "✕" : "✎"}
        </button>
        {slice.editing && (
          <button
            className="p-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
            onClick={onSave}>
            ✓
          </button>
        )}
      </div>
    </li>
  )
}
