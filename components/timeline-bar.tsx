import type { VideoSlice } from "~types"

const COLORS = [
  "bg-blue-300/60 dark:bg-blue-500/40",
  "bg-green-300/60 dark:bg-green-500/40",
  "bg-purple-300/60 dark:bg-purple-500/40",
  "bg-amber-300/60 dark:bg-amber-500/40",
  "bg-pink-300/60 dark:bg-pink-500/40",
  "bg-teal-300/60 dark:bg-teal-500/40"
]

function hashTag(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) & 0xffffffff
  }
  return hash
}

function getColor(slice: VideoSlice): string {
  const idx =
    Math.abs(hashTag(slice.tags?.[0] || slice.id)) % COLORS.length
  return COLORS[idx]
}

export default function TimelineBar({
  slices,
  duration,
  startSeconds,
  endSeconds,
  settingEnd,
  startLabel,
  endLabel,
  hintText,
  onClick
}: {
  slices: VideoSlice[]
  duration: number
  startSeconds: number
  endSeconds: number
  settingEnd: boolean
  startLabel: string
  endLabel: string
  hintText: string
  onClick: (seconds: number) => void
}) {
  const dur = duration || 1
  const selLeft = (Math.min(startSeconds, endSeconds) / dur) * 100
  const selWidth =
    (Math.abs(endSeconds - startSeconds) / dur) * 100

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {chrome.i18n.getMessage("timeRange")}
        </label>
      </div>
      <div className="relative mb-3">
        <div
          className="w-full h-10 bg-gray-100 dark:bg-gray-700 rounded-lg relative cursor-pointer overflow-hidden group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const ratio = Math.max(0, Math.min(1, x / rect.width))
            onClick(Math.round(ratio * duration))
          }}
          title="First click: set start, second click: set end">
          {slices.map((slice) => {
            const left = (slice.startTime / dur) * 100
            const width = ((slice.endTime - slice.startTime) / dur) * 100
            return (
              <div
                key={slice.id}
                className={`absolute top-1 bottom-1 rounded ${getColor(slice)} border border-white/30 dark:border-gray-600/30 transition-opacity hover:opacity-90`}
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 0.3)}%`
                }}
                title={`${slice.startTimeInput} - ${slice.endTimeInput}${slice.note ? `: ${slice.note.slice(0, 40)}` : ""}`}
              />
            )
          })}
          <div
            className="absolute top-0 bottom-0 bg-blue-500/30 dark:bg-blue-400/30 border-l-2 border-r-2 border-blue-500 dark:border-blue-400 rounded pointer-events-none"
            style={{
              left: `${selLeft}%`,
              width: `${selWidth}%`
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          <span>{startLabel}</span>
          <span className="text-gray-300 dark:text-gray-600 text-[9px]">
            {hintText}
          </span>
          <span>{endLabel}</span>
        </div>
      </div>
    </div>
  )
}
