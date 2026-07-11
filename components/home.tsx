import clearIconBase64 from "data-base64:~assets/clear.png"
import pauseIconBase64 from "data-base64:~assets/pause.png"
import playIconBase64 from "data-base64:~assets/play.png"
import resetIconBase64 from "data-base64:~assets/reset.png"
import DOMPurify from "dompurify"
import { marked } from "marked"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent, DragEvent } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { useToast } from "~components/toast"
import type { VideoResult, VideoSlice } from "~types"

const TAG_COLORS = [
  "border-l-red-400",
  "border-l-blue-400",
  "border-l-green-400",
  "border-l-yellow-400",
  "border-l-purple-400",
  "border-l-pink-400",
  "border-l-indigo-400",
  "border-l-teal-400"
]

function hashTag(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) & 0xffffffff
  }
  return hash
}

function getTagBorderColor(tags: string[]): string {
  if (!tags || tags.length === 0)
    return "border-l-gray-300 dark:border-l-gray-600"
  const idx = Math.abs(hashTag(tags[0])) % TAG_COLORS.length
  return TAG_COLORS[idx]
}

const localstorage = new Storage()

export default function Home({
  currentVideo,
  refresh
}: {
  currentVideo: VideoResult
  refresh: () => void
}) {
  const [startHour, setStartHour] = useState<string>("00")
  const [startMinute, setStartMinute] = useState<string>("00")
  const [startSecond, setStartSecond] = useState<string>("00")
  const [endHour, setEndHour] = useState<string>("00")
  const [endMinute, setEndMinute] = useState<string>("00")
  const [endSecond, setEndSecond] = useState<string>("00")
  const [startTimeInput, setStartTimeInput] = useState<string>("00:00")
  const [endTimeInput, setEndTimeInput] = useState<string>("00:00")
  const [videoSlices, setVideoSlices] = useState<VideoSlice[]>([])
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [tagFilter, setTagFilter] = useState<string>("")
  const [sortMode, setSortMode] = useState<string>("created-desc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const { addToast } = useToast()
  const [loopSlices, setLoopSlices] = useState<Set<string>>(new Set())
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [settingEnd, setSettingEnd] = useState(false)
  const [imageCache, setImageCache] = useState<Map<string, string>>(new Map())
  const [undoStack, setUndoStack] = useState<VideoSlice[][]>([])
  const [redoStack, setRedoStack] = useState<VideoSlice[][]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoSlicesRef = useRef<VideoSlice[]>(videoSlices)
  videoSlicesRef.current = videoSlices
  const actionRefs = useRef<{
    undo: () => void
    redo: () => void
    handlePlayOrPause: (slice: VideoSlice) => void
  }>({
    undo: () => {},
    redo: () => {},
    handlePlayOrPause: () => {}
  })

  const timeToSeconds = (hours: string, minutes: string, seconds: string) => {
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
  }

  const pad2 = (value: number) => value.toString().padStart(2, "0")

  const createId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const secondsToTimeParts = (totalSeconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds))
    const hours = Math.floor(safeSeconds / 3600)
    const minutes = Math.floor((safeSeconds % 3600) / 60)
    const seconds = safeSeconds % 60
    return { hours, minutes, seconds }
  }

  const formatTimeInput = (totalSeconds: number) => {
    const { hours, minutes, seconds } = secondsToTimeParts(totalSeconds)
    if (hours > 0) {
      return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
    }
    return `${pad2(minutes)}:${pad2(seconds)}`
  }

  const formatDuration = (seconds: number) => {
    const { hours, minutes, seconds: secs } = secondsToTimeParts(seconds)
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  const parseTimeInput = (value: string) => {
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

  const normalizeSlice = (slice: Partial<VideoSlice>): VideoSlice => {
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

  const updateStartFromParts = (
    hours: string,
    minutes: string,
    seconds: string
  ) => {
    setStartHour(hours)
    setStartMinute(minutes)
    setStartSecond(seconds)
    setStartTimeInput(formatTimeInput(timeToSeconds(hours, minutes, seconds)))
  }

  const updateEndFromParts = (
    hours: string,
    minutes: string,
    seconds: string
  ) => {
    setEndHour(hours)
    setEndMinute(minutes)
    setEndSecond(seconds)
    setEndTimeInput(formatTimeInput(timeToSeconds(hours, minutes, seconds)))
  }

  const setStartFromSeconds = (seconds: number) => {
    const { hours, minutes, seconds: secs } = secondsToTimeParts(seconds)
    updateStartFromParts(pad2(hours), pad2(minutes), pad2(secs))
  }

  const setEndFromSeconds = (seconds: number) => {
    const { hours, minutes, seconds: secs } = secondsToTimeParts(seconds)
    updateEndFromParts(pad2(hours), pad2(minutes), pad2(secs))
  }

  const applyStartTimeInput = () => {
    const seconds = parseTimeInput(startTimeInput)
    if (seconds === null) {
      addToast(chrome.i18n.getMessage("errorInvalidTimeFormat"), "error")
      return
    }
    setStartFromSeconds(seconds)
  }

  const applyEndTimeInput = () => {
    const seconds = parseTimeInput(endTimeInput)
    if (seconds === null) {
      addToast(chrome.i18n.getMessage("errorInvalidTimeFormat"), "error")
      return
    }
    setEndFromSeconds(seconds)
  }

  const generateOptions = useMemo(() => {
    return (range: number) => {
      const options = []
      for (let i = 0; i < range; i++) {
        const value = i.toString().padStart(2, "0")
        options.push(
          <option key={i} value={value}>
            {value}
          </option>
        )
      }
      return options
    }
  }, [])

  const filteredSlices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const tagQuery = tagFilter.trim().toLowerCase()

    const matchesQuery = (slice: VideoSlice) => {
      if (!query) return true
      const fields = [
        slice.note || "",
        slice.startTimeInput || "",
        slice.endTimeInput || "",
        (slice.tags || []).join(" ")
      ]
      return fields.some((field) => field.toLowerCase().includes(query))
    }

    const matchesTag = (slice: VideoSlice) => {
      if (!tagQuery) return true
      return (slice.tags || []).some((tag) =>
        tag.toLowerCase().includes(tagQuery)
      )
    }

    const sorted = [...videoSlices].filter(
      (slice) => matchesQuery(slice) && matchesTag(slice)
    )

    switch (sortMode) {
      case "start-asc":
        sorted.sort((a, b) => a.startTime - b.startTime)
        break
      case "start-desc":
        sorted.sort((a, b) => b.startTime - a.startTime)
        break
      case "end-asc":
        sorted.sort((a, b) => a.endTime - b.endTime)
        break
      case "end-desc":
        sorted.sort((a, b) => b.endTime - a.endTime)
        break
      case "custom":
        break
      case "created-asc":
        sorted.sort((a, b) => a.createdAt - b.createdAt)
        break
      case "created-desc":
      default:
        sorted.sort((a, b) => b.createdAt - a.createdAt)
        break
    }

    return sorted
  }, [searchQuery, tagFilter, sortMode, videoSlices])

  const moveSlice = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setVideoSlices((currentSlices) => {
      const fromIndex = currentSlices.findIndex(
        (slice) => slice.id === sourceId
      )
      const toIndex = currentSlices.findIndex((slice) => slice.id === targetId)
      if (fromIndex === -1 || toIndex === -1) return currentSlices

      const updatedSlices = [...currentSlices]
      const [moved] = updatedSlices.splice(fromIndex, 1)
      updatedSlices.splice(toIndex, 0, moved)
      localstorage.set(currentVideo.videoURL, updatedSlices)
      return updatedSlices
    })
  }

  const handleDragStart = (id: string) => {
    if (sortMode !== "custom") {
      setSortMode("custom")
    }
    setDraggingId(id)
  }

  const handleDragOver = (event: DragEvent<HTMLLIElement>, id: string) => {
    if (sortMode !== "custom") return
    event.preventDefault()
    setDragOverId(id)
  }

  const handleDrop = (event: DragEvent<HTMLLIElement>, id: string) => {
    if (sortMode !== "custom") return
    event.preventDefault()
    if (draggingId) {
      moveSlice(draggingId, id)
    }
    setDraggingId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverId(null)
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredSlices.map((slice) => slice.id)))
  }

  const updateSliceTags = (id: string, value: string) => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    setVideoSlices((currentSlices) =>
      currentSlices.map((slice) => {
        if (slice.id === id) {
          return { ...slice, tags }
        }
        return slice
      })
    )
  }

  const updateSliceNote = (
    id: string,
    updater: (current: string) => string
  ) => {
    setVideoSlices((currentSlices) => {
      const updated = currentSlices.map((slice) => {
        if (slice.id === id) {
          return { ...slice, note: updater(slice.note || "") }
        }
        return slice
      })
      localstorage.set(currentVideo.videoURL, updated).catch(() => {
        // storage quota may be exceeded
      })
      return updated
    })
  }

  const appendToSliceNote = (id: string, snippet: string) => {
    updateSliceNote(id, (current) => {
      const trimmed = current.trim()
      if (!trimmed) {
        return snippet
      }
      return `${trimmed}\n${snippet}`
    })
  }

  const handleInsertTemplate = (
    event: ChangeEvent<HTMLSelectElement>,
    id: string
  ) => {
    const template = noteTemplates.find(
      (item) => item.key === event.target.value
    )
    if (template) {
      appendToSliceNote(id, template.snippet)
      event.target.value = ""
    }
  }

  const handleInsertImage = (id: string) => {
    const url = window.prompt(chrome.i18n.getMessage("promptImageUrl"))
    if (!url) return
    try {
      const parsed = new URL(url)
      if (!["http:", "https:", "data:"].includes(parsed.protocol)) return
    } catch {
      return
    }
    appendToSliceNote(id, `![Image](${url})`)
  }

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) {
      addToast(chrome.i18n.getMessage("errorNoSelection"), "error")
      return
    }
    pushUndo(videoSlicesRef.current)
    const removeKeys = Array.from(selectedIds).map((id) => `vn_img_${id}`)
    chrome.storage.local.remove(removeKeys)
    setImageCache((prev) => {
      const next = new Map(prev)
      for (const key of removeKeys) next.delete(key)
      return next
    })
    setVideoSlices((currentSlices) => {
      const updatedSlices = currentSlices.filter(
        (slice) => !selectedIds.has(slice.id)
      )
      localstorage.set(currentVideo.videoURL, updatedSlices)
      return updatedSlices
    })
    clearSelection()
    addToast(chrome.i18n.getMessage("successDeleted"), "success")
  }

  const handleBatchExport = () => {
    if (selectedIds.size === 0) {
      addToast(chrome.i18n.getMessage("errorNoSelection"), "error")
      return
    }
    const exportSlices = videoSlices.filter((slice) =>
      selectedIds.has(slice.id)
    )
    const dataStr = JSON.stringify(exportSlices, null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `video-slices-${Date.now()}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
    addToast(chrome.i18n.getMessage("successExported"), "success")
  }

  const handleMergeSelected = () => {
    if (selectedIds.size < 2) {
      addToast(chrome.i18n.getMessage("errorMergeNeedTwo"), "error")
      return
    }
    const selectedSlices = videoSlices.filter((slice) =>
      selectedIds.has(slice.id)
    )
    const startTime = Math.min(...selectedSlices.map((s) => s.startTime))
    const endTime = Math.max(...selectedSlices.map((s) => s.endTime))
    const mergedTags = Array.from(
      new Set(selectedSlices.flatMap((s) => s.tags || []))
    )
    const mergedNote = selectedSlices
      .map((s) => s.note)
      .filter(Boolean)
      .join("\n")

    const mergedSlice: VideoSlice = {
      id: createId(),
      createdAt: Date.now(),
      startTime,
      endTime,
      startTimeInput: formatTimeInput(startTime),
      endTimeInput: formatTimeInput(endTime),
      isPlaying: false,
      note: mergedNote,
      editing: false,
      tags: mergedTags
    }

    pushUndo(videoSlicesRef.current)

    setVideoSlices((currentSlices) => {
      const updatedSlices = currentSlices
        .filter((slice) => !selectedIds.has(slice.id))
        .concat(mergedSlice)
      localstorage.set(currentVideo.videoURL, updatedSlices)
      return updatedSlices
    })

    clearSelection()
    addToast(chrome.i18n.getMessage("successMerged"), "success")
  }

  const noteTemplates = [
    {
      key: "template-summary",
      label: chrome.i18n.getMessage("templateSummary"),
      snippet: "## Summary\n- "
    },
    {
      key: "template-action",
      label: chrome.i18n.getMessage("templateActionItems"),
      snippet: "## Action Items\n- [ ] "
    },
    {
      key: "template-meeting",
      label: chrome.i18n.getMessage("templateMeetingNotes"),
      snippet:
        "## Meeting Notes\n**Topic:** \n**Key Takeaways:**\n- \n**Follow-ups:**\n- "
    }
  ]

  const pushUndo = (slices: VideoSlice[]) => {
    setUndoStack((prev) => [...prev.slice(-49), slices])
    setRedoStack([])
  }

  const undo = () => {
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))
    setRedoStack((prev) => [...prev, videoSlicesRef.current])
    setVideoSlices(previous)
    localstorage.set(currentVideo.videoURL, previous)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, -1))
    setUndoStack((prev) => [...prev, videoSlicesRef.current])
    setVideoSlices(next)
    localstorage.set(currentVideo.videoURL, next)
  }

  const computeCoverage = () => {
    if (!currentVideo.video || currentVideo.video.duration === 0) {
      return { totalMarked: 0, totalDuration: 0, percent: 0 }
    }
    const totalDuration = currentVideo.video.duration
    if (videoSlices.length === 0) {
      return { totalMarked: 0, totalDuration, percent: 0 }
    }
    const sorted = [...videoSlices].sort((a, b) => a.startTime - b.startTime)
    let totalMarked = 0
    let currentStart = sorted[0].startTime
    let currentEnd = sorted[0].endTime
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime <= currentEnd) {
        currentEnd = Math.max(currentEnd, sorted[i].endTime)
      } else {
        totalMarked += currentEnd - currentStart
        currentStart = sorted[i].startTime
        currentEnd = sorted[i].endTime
      }
    }
    totalMarked += currentEnd - currentStart
    const percent = Math.round((totalMarked / totalDuration) * 100)
    return { totalMarked, totalDuration, percent }
  }

  const handleMarkdownExport = () => {
    const exportSlices =
      selectedIds.size > 0
        ? videoSlices.filter((slice) => selectedIds.has(slice.id))
        : videoSlices
    if (exportSlices.length === 0) {
      addToast(chrome.i18n.getMessage("errorNoSelection"), "error")
      return
    }
    const sorted = [...exportSlices].sort((a, b) => a.startTime - b.startTime)
    const lines: string[] = [
      `# ${currentVideo.tabTitle || "Video Notes"}`,
      `> ${currentVideo.videoURL}`,
      ""
    ]
    for (const slice of sorted) {
      const tags =
        slice.tags && slice.tags.length > 0 ? ` (${slice.tags.join(", ")})` : ""
      lines.push(`## ${slice.startTimeInput} - ${slice.endTimeInput}${tags}`)
      if (slice.note && slice.note.trim()) {
        lines.push("")
        lines.push(slice.note.trim())
      }
      lines.push("")
      lines.push("---")
      lines.push("")
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `video-notes-${Date.now()}.md`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
    addToast(chrome.i18n.getMessage("successExportedMd"), "success")
  }

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result
        if (typeof text !== "string") return
        const data = JSON.parse(text)
        if (!Array.isArray(data)) {
          addToast(chrome.i18n.getMessage("errorImportFormat"), "error")
          return
        }
        const imported = data.map((item) => normalizeSlice(item))
        const existingIds = new Set(videoSlicesRef.current.map((s) => s.id))
        const newCount = imported.filter((s) => !existingIds.has(s.id)).length
        pushUndo(videoSlicesRef.current)
        setVideoSlices((current) => {
          const currentIds = new Set(current.map((s) => s.id))
          const newSlices = imported.filter((s) => !currentIds.has(s.id))
          const merged = [...current, ...newSlices]
          localstorage.set(currentVideo.videoURL, merged)
          return merged
        })
        addToast(
          chrome.i18n
            .getMessage("successImported")
            .replace("{count}", String(newCount)),
          "success"
        )
      } catch {
        addToast(chrome.i18n.getMessage("errorImportFormat"), "error")
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  const handleCaptureFrame = async (id: string) => {
    addToast(chrome.i18n.getMessage("capturing"), "info")
    try {
      const res = await sendToBackground({
        name: "capture-frame",
        body: { tabId: currentVideo.tabId }
      })
      if (res?.dataUrl) {
        const imgKey = `vn_img_${id}`
        await chrome.storage.local.set({ [imgKey]: res.dataUrl })
        setImageCache((prev) => new Map(prev).set(imgKey, res.dataUrl))
        appendToSliceNote(id, `![Screenshot](vn://${imgKey})`)
        addToast(chrome.i18n.getMessage("successCapture"), "success")
      } else {
        addToast(chrome.i18n.getMessage("errorCaptureFailed"), "error")
      }
    } catch {
      addToast(chrome.i18n.getMessage("errorCaptureFailed"), "error")
    }
  }

  const toggleSliceLoop = (id: string) => {
    setLoopSlices((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSeekTimestamp = async (seconds: number) => {
    await sendToBackground({
      name: "seek-to",
      body: { tabId: currentVideo.tabId, time: seconds }
    })
  }

  const TIMESTAMP_PLACEHOLDER = "__VN_TS_"

  const extractTimestamps = (
    text: string
  ): { processed: string; timestamps: Map<string, number> } => {
    const timestamps = new Map<string, number>()
    let counter = 0
    const processed = text.replace(
      /\[(\d{1,3}):([0-5]\d)(?::([0-5]\d))?\]/g,
      (_match, hOrM: string, mOrS: string, s?: string) => {
        let totalSeconds: number
        if (s !== undefined) {
          const hours = Number(hOrM)
          const minutes = Number(mOrS)
          const seconds = Number(s)
          if (minutes >= 60 || seconds >= 60) return _match
          totalSeconds = hours * 3600 + minutes * 60 + seconds
        } else {
          const minutes = Number(hOrM)
          const seconds = Number(mOrS)
          if (seconds >= 60) return _match
          totalSeconds = minutes * 60 + seconds
        }
        const key = `${TIMESTAMP_PLACEHOLDER}${counter}`
        timestamps.set(key, totalSeconds)
        counter++
        return key
      }
    )
    return { processed, timestamps }
  }

  const restoreTimestampLinks = (
    html: string,
    timestamps: Map<string, number>
  ): string => {
    let result = html
    timestamps.forEach((seconds, key) => {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      result = result.replace(
        new RegExp(escaped, "g"),
        `<a class="timestamp-link text-blue-500 hover:text-blue-700 cursor-pointer" data-timestamp="${seconds}">[${formatTimeInput(seconds)}]</a>`
      )
    })
    return result
  }

  const renderMarkdown = (text: string) => {
    let resolved = text.replace(
      /\[([^\]]*)\]\(vn:\/\/(vn_img_[^)]+)\)/g,
      (_m, alt, key) => {
        const dataUrl = imageCache.get(key)
        return dataUrl ? `[${alt}](${dataUrl})` : _m
      }
    )
    const { processed, timestamps } = extractTimestamps(resolved)
    const raw = DOMPurify.sanitize(
      marked.parse(processed, { async: false }) as string
    )
    return timestamps.size > 0 ? restoreTimestampLinks(raw, timestamps) : raw
  }

  const handleNoteChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    id: string
  ) => {
    const newNote = event.target.value
    setVideoSlices((currentSlices) =>
      currentSlices.map((slice) => {
        if (slice.id === id) {
          return { ...slice, note: newNote }
        }
        return slice
      })
    )
  }

  const toggleEdit = (id: string) => {
    setVideoSlices((currentSlices) =>
      currentSlices.map((slice) => {
        if (slice.id === id) {
          return { ...slice, editing: !slice.editing }
        }
        return slice
      })
    )
  }

  const saveNotes = (id: string) => {
    setVideoSlices((currentSlices) => {
      const updatedSlices = currentSlices.map((slice) => {
        if (slice.id === id) {
          return { ...slice, editing: false }
        }
        return slice
      })
      localstorage.set(currentVideo.videoURL, updatedSlices)
      return updatedSlices
    })
    addToast(chrome.i18n.getMessage("successNotesSaved"), "success")
  }

  const addSlice = async () => {
    const startTimeInSeconds = timeToSeconds(
      startHour,
      startMinute,
      startSecond
    )
    const endTimeInSeconds = timeToSeconds(endHour, endMinute, endSecond)
    if (startTimeInSeconds > endTimeInSeconds) {
      addToast(chrome.i18n.getMessage("errorStartGreaterThanEnd"), "error")
      return
    }
    if (
      startTimeInSeconds > currentVideo.video.duration ||
      endTimeInSeconds > currentVideo.video.duration
    ) {
      addToast(chrome.i18n.getMessage("errorTimeExceedsDuration"), "error")
      return
    }
    const newSlice: VideoSlice = {
      id: createId(),
      createdAt: Date.now(),
      startTime: startTimeInSeconds,
      endTime: endTimeInSeconds,
      startTimeInput: `${startHour}:${startMinute}:${startSecond}`,
      endTimeInput: `${endHour}:${endMinute}:${endSecond}`,
      isPlaying: false,
      note: "",
      editing: false,
      tags: []
    }
    const updatedSlices: VideoSlice[] = [...videoSlices, newSlice]
    setVideoSlices(updatedSlices)
    await localstorage.set(currentVideo.videoURL, updatedSlices)
    addToast(chrome.i18n.getMessage("successSegmentAdded"), "success")
  }

  const handlePlayOrPause = async (slice: VideoSlice) => {
    setVideoSlices((currentSlices) =>
      currentSlices.map((s) => {
        if (s.id === slice.id) {
          return { ...s, isPlaying: !s.isPlaying }
        }
        return s
      })
    )
    if (!slice.isPlaying) {
      await sendToBackground({
        name: "play",
        body: {
          tabId: currentVideo.tabId,
          isPlay: true,
          slice: slice,
          loop: loopSlices.has(slice.id)
        }
      })
    } else {
      await sendToBackground({
        name: "pause",
        body: {
          tabId: currentVideo.tabId,
          isPlay: false,
          slice: slice
        }
      })
    }
  }

  const handleReset = async (slice: VideoSlice) => {
    setVideoSlices((currentSlices) =>
      currentSlices.map((s) => {
        if (s.id === slice.id) {
          return { ...s, isPlaying: true }
        } else {
          return { ...s, isPlaying: false }
        }
      })
    )
    await sendToBackground({
      name: "video-slice",
      body: {
        tabId: currentVideo.tabId,
        startTime: slice.startTime,
        endTime: slice.endTime,
        loop: loopSlices.has(slice.id)
      }
    })
  }

  const secondsToMinutes = (seconds: number) => {
    return (seconds / 60).toFixed(2)
  }

  const removeSlice = (id: string) => {
    pushUndo(videoSlicesRef.current)
    chrome.storage.local.remove(`vn_img_${id}`)
    setImageCache((prev) => {
      const next = new Map(prev)
      next.delete(`vn_img_${id}`)
      return next
    })
    setVideoSlices((currentSlices) => {
      const updatedSlices = currentSlices.filter((slice) => slice.id !== id)
      localstorage.set(currentVideo.videoURL, updatedSlices)
      return updatedSlices
    })
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  actionRefs.current = { undo, redo, handlePlayOrPause }

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault()
        const playingSlice = videoSlicesRef.current.find((s) => s.isPlaying)
        if (playingSlice) {
          actionRefs.current.handlePlayOrPause(playingSlice)
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        sendToBackground({
          name: "seek-to",
          body: { tabId: currentVideo.tabId, time: -5, relative: true }
        })
      }
      if (e.key === "ArrowRight") {
        e.preventDefault()
        sendToBackground({
          name: "seek-to",
          body: { tabId: currentVideo.tabId, time: 5, relative: true }
        })
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        actionRefs.current.undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault()
        actionRefs.current.redo()
      }
      if (e.key === "?") {
        e.preventDefault()
        setShowShortcuts(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "S" && e.shiftKey) {
        e.preventDefault()
        sendToBackground({ name: "get-current-time" }).then((res) => {
          if (res?.currentTime != null) {
            const seconds = Math.round(res.currentTime)
            if (settingEnd) {
              const startSec = timeToSeconds(
                startHour,
                startMinute,
                startSecond
              )
              if (seconds < startSec) {
                setStartFromSeconds(seconds)
                setEndFromSeconds(startSec)
              } else {
                setEndFromSeconds(seconds)
              }
              setSettingEnd(false)
              addToast(`End snapped to ${formatTimeInput(seconds)}`, "info")
            } else {
              setStartFromSeconds(seconds)
              setSettingEnd(true)
              addToast(`Start snapped to ${formatTimeInput(seconds)}`, "info")
            }
          }
        })
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentVideo.tabId, settingEnd, startHour, startMinute, startSecond])

  useEffect(() => {
    const getCurrentVideoSlice = async (currentVideo: VideoResult) => {
      const res: VideoSlice[] = await localstorage.get(currentVideo.videoURL)
      if (res) {
        const normalized = res.map((slice) => normalizeSlice(slice))
        setVideoSlices(normalized)
        setSelectedIds(new Set())

        const imgKeys = new Set<string>()
        for (const slice of normalized) {
          const matches = slice.note.matchAll(/vn:\/\/(vn_img_[^)\s]+)/g)
          for (const m of matches) {
            imgKeys.add(m[1])
          }
        }
        if (imgKeys.size > 0) {
          const stored = await chrome.storage.local.get(Array.from(imgKeys))
          const cache = new Map<string, string>()
          for (const [key, value] of Object.entries(stored)) {
            if (typeof value === "string") cache.set(key, value)
          }
          setImageCache(cache)
        }

        const needsSave = res.some(
          (slice) => !slice.id || !slice.createdAt || !slice.tags
        )
        if (needsSave) {
          await localstorage.set(currentVideo.videoURL, normalized)
        }
      } else {
        setVideoSlices([])
        setSelectedIds(new Set())
        setImageCache(new Map())
      }
    }
    getCurrentVideoSlice(currentVideo)
  }, [currentVideo])

  return (
    <>
      {!currentVideo.video && (
        <div className="flex flex-col items-center justify-center p-4">
          <p className="text-gray-600 dark:text-gray-300 text-lg mb-2">
            {chrome.i18n.getMessage("noVideo")}
          </p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:shadow-xl transition duration-300 ease-in-out"
            onClick={refresh}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-rotate-ccw w-4 h-4 inline-block mr-2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            {chrome.i18n.getMessage("reload")}
          </button>
        </div>
      )}
      {currentVideo.video && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center dark:text-white">
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {chrome.i18n.getMessage("videoInfo")}
            <button
              className="ml-2 bg-transparent rounded-full transition duration-150 ease-in-out hover:bg-gray-100 rounded-md"
              title={chrome.i18n.getMessage("reload")}
              onClick={refresh}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-rotate-ccw w-4 h-4 inline-block mr-2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </h2>
          <p className="mb-2 dark:text-gray-200">
            {chrome.i18n.getMessage("videoName")}:{" "}
            <a
              href={currentVideo.videoURL}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              title={chrome.i18n.getMessage("hintTitle")}
              onClick={(e) => {
                e.preventDefault()
                chrome.tabs.update(currentVideo.tabId, { active: true })
              }}>
              {currentVideo.tabTitle}
            </a>
          </p>
          <p className="mb-4 dark:text-gray-200">
            {" "}
            {chrome.i18n.getMessage("duration")}:{" "}
            {secondsToMinutes(currentVideo.video.duration)}
          </p>
          <div className="flex justify-between items-end mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {chrome.i18n.getMessage("startTime")}
              </label>
              <div className="flex">
                <select
                  className="mt-1 pl-2 pr-5 py-1 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-lg"
                  value={startHour}
                  onChange={(e) =>
                    updateStartFromParts(
                      e.target.value,
                      startMinute,
                      startSecond
                    )
                  }>
                  {generateOptions(24)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-t border-b border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={startMinute}
                  onChange={(e) =>
                    updateStartFromParts(startHour, e.target.value, startSecond)
                  }>
                  {generateOptions(60)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                  value={startSecond}
                  onChange={(e) =>
                    updateStartFromParts(startHour, startMinute, e.target.value)
                  }>
                  {generateOptions(60)}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  className="w-24 px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                  placeholder={chrome.i18n.getMessage("timeInputPlaceholder")}
                  value={startTimeInput}
                  onChange={(e) => setStartTimeInput(e.target.value)}
                  onBlur={applyStartTimeInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      applyStartTimeInput()
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {chrome.i18n.getMessage("endTime")}
              </label>
              <div className="flex gap-1">
                <select
                  className="mt-1 pl-2 pr-5 py-1 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-lg"
                  value={endHour}
                  onChange={(e) =>
                    updateEndFromParts(e.target.value, endMinute, endSecond)
                  }>
                  {generateOptions(24)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-t border-b border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={endMinute}
                  onChange={(e) =>
                    updateEndFromParts(endHour, e.target.value, endSecond)
                  }>
                  {generateOptions(60)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                  value={endSecond}
                  onChange={(e) =>
                    updateEndFromParts(endHour, endMinute, e.target.value)
                  }>
                  {generateOptions(60)}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  className="w-24 px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                  placeholder={chrome.i18n.getMessage("timeInputPlaceholder")}
                  value={endTimeInput}
                  onChange={(e) => setEndTimeInput(e.target.value)}
                  onBlur={applyEndTimeInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      applyEndTimeInput()
                    }
                  }}
                />
              </div>
            </div>
          </div>
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
                  const seconds = Math.round(
                    ratio * (currentVideo.video?.duration || 0)
                  )
                  if (settingEnd) {
                    const startSec = timeToSeconds(
                      startHour,
                      startMinute,
                      startSecond
                    )
                    if (seconds < startSec) {
                      setStartFromSeconds(seconds)
                      setEndFromSeconds(startSec)
                    } else {
                      setEndFromSeconds(seconds)
                    }
                    setSettingEnd(false)
                  } else {
                    setStartFromSeconds(seconds)
                    setSettingEnd(true)
                  }
                }}
                title="First click: set start, second click: set end">
                {videoSlices.map((slice) => {
                  const dur = currentVideo.video?.duration || 1
                  const left = (slice.startTime / dur) * 100
                  const width = ((slice.endTime - slice.startTime) / dur) * 100
                  const colors = [
                    "bg-blue-300/60 dark:bg-blue-500/40",
                    "bg-green-300/60 dark:bg-green-500/40",
                    "bg-purple-300/60 dark:bg-purple-500/40",
                    "bg-amber-300/60 dark:bg-amber-500/40",
                    "bg-pink-300/60 dark:bg-pink-500/40",
                    "bg-teal-300/60 dark:bg-teal-500/40"
                  ]
                  const colorIdx =
                    Math.abs(hashTag(slice.tags?.[0] || slice.id)) %
                    colors.length
                  return (
                    <div
                      key={slice.id}
                      className={`absolute top-1 bottom-1 rounded ${colors[colorIdx]} border border-white/30 dark:border-gray-600/30 transition-opacity hover:opacity-90`}
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
                    left: `${(Math.min(timeToSeconds(startHour, startMinute, startSecond), timeToSeconds(endHour, endMinute, endSecond)) / (currentVideo.video?.duration || 1)) * 100}%`,
                    width: `${(Math.abs(timeToSeconds(endHour, endMinute, endSecond) - timeToSeconds(startHour, startMinute, startSecond)) / (currentVideo.video?.duration || 1)) * 100}%`
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                <span>
                  {formatTimeInput(
                    timeToSeconds(startHour, startMinute, startSecond)
                  )}
                </span>
                <span className="text-gray-300 dark:text-gray-600 text-[9px]">
                  {settingEnd ? "click to set end" : "click to set start"}
                </span>
                <span>
                  {formatTimeInput(
                    timeToSeconds(endHour, endMinute, endSecond)
                  )}
                </span>
              </div>
            </div>
          </div>
          <button
            className="w-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 font-medium py-2.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
            onClick={addSlice}>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            {chrome.i18n.getMessage("addTimeSegment")}
          </button>
          {videoSlices.length > 0 &&
            (() => {
              const coverage = computeCoverage()
              return (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{chrome.i18n.getMessage("coverageStats")}</span>
                    <span>
                      {chrome.i18n
                        .getMessage("coverage")
                        .replace("{percent}", String(coverage.percent))}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(coverage.percent, 100)}%`
                      }}
                    />
                  </div>
                </div>
              )
            })()}
        </div>
      )}
      {currentVideo.video && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center dark:text-white">
            {chrome.i18n.getMessage("timeSegment")}
          </h2>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative flex-1 min-w-[120px]">
                <svg
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder:text-gray-400"
                  placeholder={chrome.i18n.getMessage("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <input
                type="text"
                className="w-28 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder:text-gray-400"
                placeholder={chrome.i18n.getMessage("tagFilterPlaceholder")}
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              />
              <select
                className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}>
                <option value="created-desc">
                  {chrome.i18n.getMessage("sortCreatedDesc")}
                </option>
                <option value="created-asc">
                  {chrome.i18n.getMessage("sortCreatedAsc")}
                </option>
                <option value="start-asc">
                  {chrome.i18n.getMessage("sortStartAsc")}
                </option>
                <option value="start-desc">
                  {chrome.i18n.getMessage("sortStartDesc")}
                </option>
                <option value="end-asc">
                  {chrome.i18n.getMessage("sortEndAsc")}
                </option>
                <option value="end-desc">
                  {chrome.i18n.getMessage("sortEndDesc")}
                </option>
                <option value="custom">
                  {chrome.i18n.getMessage("sortCustom")}
                </option>
              </select>
              <button
                className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setShowShortcuts(true)}
                type="button"
                title={chrome.i18n.getMessage("shortcutsTitle")}>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Shortcuts
              </button>
            </div>
            <div className="flex items-center gap-3 py-2 px-1">
              <div className="flex items-center gap-0.5">
                <button
                  className="px-2 py-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                  onClick={selectAllVisible}
                  type="button">
                  {chrome.i18n.getMessage("selectAll")}
                </button>
                <button
                  className="px-2 py-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                  onClick={clearSelection}
                  type="button">
                  {chrome.i18n.getMessage("clearSelection")}
                </button>
              </div>
              {selectedIds.size > 0 && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                  {selectedIds.size} selected
                </span>
              )}
              <div className="flex-1" />
              <div className="flex items-center gap-0.5">
                <div className="relative group">
                  <button
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={handleBatchExport}
                    type="button">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </button>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {chrome.i18n.getMessage("exportSelected")}
                  </span>
                </div>
                <div className="relative group">
                  <button
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={handleMarkdownExport}
                    type="button">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {chrome.i18n.getMessage("exportMarkdown")}
                  </span>
                </div>
                <div className="relative group">
                  <button
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={handleMergeSelected}
                    type="button">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </button>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {chrome.i18n.getMessage("mergeSelected")}
                  </span>
                </div>
                <div className="relative group">
                  <button
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    type="button">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  </button>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {chrome.i18n.getMessage("importSlices")}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                />
              </div>
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
              <div className="relative group">
                <button
                  className={`p-1.5 rounded-md transition-colors ${
                    selectedIds.size > 0
                      ? "text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "text-gray-300 dark:text-gray-700 cursor-default"
                  }`}
                  onClick={handleBatchDelete}
                  type="button"
                  disabled={selectedIds.size === 0}>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
                {selectedIds.size > 0 && (
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-600 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {chrome.i18n.getMessage("deleteSelected")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ul>
            {filteredSlices.map((slice: VideoSlice) => (
              <li
                key={slice.id}
                className={`group flex flex-col p-3.5 mb-2 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-200 border-l-[3px] ${getTagBorderColor(slice.tags)} ${
                  sortMode === "custom" ? "cursor-move" : ""
                } ${dragOverId === slice.id ? "ring-2 ring-blue-400 shadow-md" : ""} ${
                  slice.isPlaying
                    ? "ring-1 ring-blue-300/50 dark:ring-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)] animate-pulse"
                    : ""
                }`}
                draggable={sortMode === "custom"}
                onDragStart={() => handleDragStart(slice.id)}
                onDragOver={(event) => handleDragOver(event, slice.id)}
                onDrop={(event) => handleDrop(event, slice.id)}
                onDragEnd={handleDragEnd}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(slice.id)}
                      onChange={() => toggleSelection(slice.id)}
                    />
                    <div>
                      <span className="dark:text-gray-200">
                        {slice.startTimeInput} - {slice.endTimeInput}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">
                        {formatDuration(slice.endTime - slice.startTime)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handlePlayOrPause(slice)}
                      title={slice.isPlaying ? "Pause" : "Play"}>
                      <img
                        src={slice.isPlaying ? pauseIconBase64 : playIconBase64}
                        alt={slice.isPlaying ? "Pause" : "Play"}
                        className="h-4 w-4"
                      />
                    </button>
                    <button
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleReset(slice)}
                      title="Reset">
                      <img
                        src={resetIconBase64}
                        alt="Reset"
                        className="h-4 w-4"
                      />
                    </button>
                    <button
                      className={`p-1.5 rounded-lg transition-colors ${
                        loopSlices.has(slice.id)
                          ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                      }`}
                      onClick={() => toggleSliceLoop(slice.id)}
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
                      onClick={() => removeSlice(slice.id)}
                      title="Remove">
                      <img
                        src={clearIconBase64}
                        alt="Remove"
                        className="h-4 w-4"
                      />
                    </button>
                  </div>
                </div>
                {slice.editing ? (
                  <>
                    <div className="flex flex-wrap gap-2 text-xs mt-2">
                      <span className="text-gray-500 dark:text-gray-400">
                        {chrome.i18n.getMessage("noteToolbar")}
                      </span>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
                        onClick={() =>
                          appendToSliceNote(slice.id, "**bold text**")
                        }>
                        {chrome.i18n.getMessage("boldLabel")}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
                        onClick={() =>
                          appendToSliceNote(slice.id, "*italic text*")
                        }>
                        {chrome.i18n.getMessage("italicLabel")}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
                        onClick={() =>
                          appendToSliceNote(slice.id, "```\ncode block\n```")
                        }>
                        {chrome.i18n.getMessage("codeLabel")}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
                        onClick={() => handleInsertImage(slice.id)}>
                        {chrome.i18n.getMessage("insertImage")}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
                        onClick={() => handleCaptureFrame(slice.id)}>
                        {chrome.i18n.getMessage("captureFrame")}
                      </button>
                      <select
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-md focus:outline-none"
                        defaultValue=""
                        onChange={(event) =>
                          handleInsertTemplate(event, slice.id)
                        }>
                        <option value="" disabled>
                          {chrome.i18n.getMessage("templateLabel")}
                        </option>
                        {noteTemplates.map((template) => (
                          <option key={template.key} value={template.key}>
                            {template.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      className="mt-2 p-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg transition-shadow duration-300 ease-in-out focus:border-blue-400 focus:ring focus:ring-blue-300 focus:ring-opacity-50 w-full"
                      value={slice.note || ""}
                      onChange={(e) => handleNoteChange(e, slice.id)}
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
                              if (ts) {
                                handleSeekTimestamp(Number(ts))
                              }
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
                        if (ts) {
                          handleSeekTimestamp(Number(ts))
                        }
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
                    onChange={(e) => updateSliceTags(slice.id, e.target.value)}
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
                    onClick={() => toggleEdit(slice.id)}>
                    {slice.editing ? (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="m18 5-3-3H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"
                        />
                        <path d="M8 18h1" />
                        <path d="M18.4 9.6a2 2 0 1 1 3 3L17 17l-4 1 1-4Z" />
                      </svg>
                    )}
                  </button>
                  {slice.editing && (
                    <button
                      className="p-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
                      onClick={() => saveNotes(slice.id)}>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold dark:text-white">
                {chrome.i18n.getMessage("shortcutsTitle")}
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => setShowShortcuts(false)}>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>{chrome.i18n.getMessage("shortcutsSpace")}</span>
                <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  Space
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>{chrome.i18n.getMessage("shortcutsSeek")}</span>
                <span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                    ←
                  </kbd>{" "}
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                    →
                  </kbd>
                </span>
              </div>
              <div className="flex justify-between">
                <span>{chrome.i18n.getMessage("shortcutsUndo")}</span>
                <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  Ctrl+Z
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>{chrome.i18n.getMessage("shortcutsRedo")}</span>
                <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  Ctrl+Shift+Z
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Snap current time</span>
                <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  Ctrl+Shift+S
                </kbd>
              </div>
            </div>
            <button
              className="mt-4 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm"
              onClick={() => setShowShortcuts(false)}>
              {chrome.i18n.getMessage("shortcutsClose")}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
