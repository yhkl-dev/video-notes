import type { VideoSlice } from "~types"

export const TAG_COLORS = [
  "border-l-red-400",
  "border-l-blue-400",
  "border-l-green-400",
  "border-l-yellow-400",
  "border-l-purple-400",
  "border-l-pink-400",
  "border-l-indigo-400",
  "border-l-teal-400"
]

export function hashTag(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) & 0xffffffff
  }
  return hash
}

export function getTagBorderColor(tags: string[]): string {
  if (!tags || tags.length === 0)
    return "border-l-gray-300 dark:border-l-gray-600"
  const idx = Math.abs(hashTag(tags[0])) % TAG_COLORS.length
  return TAG_COLORS[idx]
}

export function pad2(value: number): string {
  return value.toString().padStart(2, "0")
}

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function secondsToTimeParts(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  return { hours, minutes, seconds }
}

export function timeToSeconds(
  hours: string,
  minutes: string,
  seconds: string
): number {
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

export function formatTimeInput(totalSeconds: number): string {
  const { hours, minutes, seconds } = secondsToTimeParts(totalSeconds)
  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  }
  return `${pad2(minutes)}:${pad2(seconds)}`
}

export function formatDuration(seconds: number): string {
  const { hours, minutes, seconds: secs } = secondsToTimeParts(seconds)
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

export function parseTimeInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split(":")
  if (parts.length !== 2 && parts.length !== 3) return null

  const numbers = parts.map((part) => Number(part))
  if (numbers.some((num) => Number.isNaN(num) || num < 0)) return null

  if (parts.length === 2) {
    const [minutes, seconds] = numbers
    if (seconds >= 60) return null
    return minutes * 60 + seconds
  }

  const [hours, minutes, seconds] = numbers
  if (minutes >= 60 || seconds >= 60) return null
  return hours * 3600 + minutes * 60 + seconds
}

export function normalizeSlice(slice: Partial<VideoSlice>): VideoSlice {
  return {
    id: slice.id || createId(),
    createdAt: slice.createdAt || Date.now(),
    startTime: slice.startTime ?? 0,
    endTime: slice.endTime ?? 0,
    startTimeInput: slice.startTimeInput || "00:00",
    endTimeInput: slice.endTimeInput || "00:00",
    isPlaying: slice.isPlaying ?? false,
    note: slice.note || "",
    editing: slice.editing ?? false,
    tags: Array.isArray(slice.tags) ? slice.tags : []
  }
}
