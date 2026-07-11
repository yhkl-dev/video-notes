import DOMPurify from "dompurify"
import { marked } from "marked"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent, DragEvent } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import CoverageBar from "~components/coverage-bar"
import ProjectSnapshots from "~components/project-snapshots"
import ShortcutsModal from "~components/shortcuts-modal"
import SliceCard from "~components/slice-card"
import TimelineBar from "~components/timeline-bar"
import { useToast } from "~components/toast"
import {
  createId,
  formatDuration,
  formatTimeInput,
  getTagBorderColor,
  normalizeSlice,
  pad2,
  parseTimeInput,
  secondsToTimeParts,
  timeToSeconds
} from "~components/utils"
import type { VideoResult, VideoSlice } from "~types"

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
  const backupInputRef = useRef<HTMLInputElement>(null)
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
    const exportSlices =
      selectedIds.size > 0
        ? videoSlices.filter((slice) => selectedIds.has(slice.id))
        : videoSlices
    if (exportSlices.length === 0) {
      addToast(chrome.i18n.getMessage("errorNoSelection"), "error")
      return
    }
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

  const handleBackupAll = async () => {
    addToast("Creating backup...", "info")
    try {
      const allData: Record<string, any> = {}
      const allKeys = await chrome.storage.local.get(null)
      for (const [key, value] of Object.entries(allKeys)) {
        allData[key] = value
      }
      const blob = new Blob([JSON.stringify(allData, null, 2)], {
        type: "application/json"
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `video-notes-backup-${Date.now()}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 100)
      addToast("Backup downloaded", "success")
    } catch {
      addToast("Backup failed", "error")
    }
  }

  const handleRestoreBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const text = e.target?.result
        if (typeof text !== "string") return
        const data = JSON.parse(text)
        let count = 0
        for (const [key, value] of Object.entries(data)) {
          await chrome.storage.local.set({ [key]: value })
          count++
        }
        addToast(`Restored ${count} items. Reload to apply.`, "success")
        setTimeout(() => refresh(), 1000)
      } catch {
        addToast("Invalid backup file", "error")
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  const handleImportYoutubeChapters = async () => {
    try {
      const res = await sendToBackground({
        name: "import-youtube-chapters",
        body: { tabId: currentVideo.tabId }
      })
      if (res?.chapters?.length > 0) {
        const newSlices: VideoSlice[] = []
        for (let i = 0; i < res.chapters.length; i++) {
          const ch = res.chapters[i]
          const endTime =
            i < res.chapters.length - 1
              ? res.chapters[i + 1].startTime
              : currentVideo.video?.duration || ch.startTime + 300
          newSlices.push({
            id: createId(),
            createdAt: Date.now(),
            startTime: ch.startTime,
            endTime,
            startTimeInput: formatTimeInput(ch.startTime),
            endTimeInput: formatTimeInput(endTime),
            isPlaying: false,
            note: ch.title,
            editing: false,
            tags: []
          })
        }
        if (newSlices.length > 0) {
          pushUndo(videoSlicesRef.current)
          setVideoSlices((current) => {
            const merged = [...current, ...newSlices]
            localstorage.set(currentVideo.videoURL, merged)
            return merged
          })
          addToast(`Imported ${newSlices.length} chapters`, "success")
        }
      } else {
        addToast("No chapters found on this page", "info")
      }
    } catch {
      addToast("Failed to import chapters", "error")
    }
  }

  const handleSrtExport = () => {
    const exportSlices =
      selectedIds.size > 0
        ? videoSlices.filter((slice) => selectedIds.has(slice.id))
        : videoSlices
    if (exportSlices.length === 0) {
      addToast(chrome.i18n.getMessage("errorNoSelection"), "error")
      return
    }
    const sorted = [...exportSlices].sort((a, b) => a.startTime - b.startTime)
    const toSrtTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = Math.floor(seconds % 60)
      const ms = Math.round((seconds - Math.floor(seconds)) * 1000)
      return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, "0")}`
    }
    const lines: string[] = []
    sorted.forEach((slice, i) => {
      lines.push(String(i + 1))
      lines.push(
        `${toSrtTime(slice.startTime)} --> ${toSrtTime(slice.endTime)}`
      )
      lines.push(slice.note?.trim() || slice.startTimeInput)
      lines.push("")
    })
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `video-subtitles-${Date.now()}.srt`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
    addToast("SRT exported", "success")
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
    const overlaps = videoSlices.filter(
      (s) => startTimeInSeconds < s.endTime && endTimeInSeconds > s.startTime
    )
    if (overlaps.length > 0) {
      addToast(
        `Overlaps with ${overlaps.length} existing segment(s)`,
        "warning"
      )
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
        } else {
          return { ...s, isPlaying: false }
        }
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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyS") {
        e.preventDefault()
        sendToBackground({
          name: "get-current-time",
          body: { tabId: currentVideo.tabId }
        }).then((res) => {
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
            } else {
              setStartFromSeconds(seconds)
              setSettingEnd(true)
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
          <TimelineBar
            slices={videoSlices}
            duration={currentVideo.video?.duration || 0}
            startSeconds={timeToSeconds(startHour, startMinute, startSecond)}
            endSeconds={timeToSeconds(endHour, endMinute, endSecond)}
            startLabel={formatTimeInput(
              timeToSeconds(startHour, startMinute, startSecond)
            )}
            endLabel={formatTimeInput(
              timeToSeconds(endHour, endMinute, endSecond)
            )}
            hintText=""
            onClick={(seconds) => {
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
          />
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
          {videoSlices.length > 0 && (
            <CoverageBar percent={computeCoverage().percent} />
          )}
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
              <ProjectSnapshots
                currentVideoURL={currentVideo.videoURL}
                videoSlices={videoSlices}
                currentVideoTitle={currentVideo.tabTitle}
                onLoadSlices={(slices) => {
                  const withNewIds = slices.map((s) => ({
                    ...s,
                    id: createId(),
                    createdAt: Date.now()
                  }))
                  setVideoSlices((current) => {
                    const merged = [...current, ...withNewIds]
                    localstorage.set(currentVideo.videoURL, merged)
                    return merged
                  })
                }}
              />
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
                <>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                    {selectedIds.size} selected
                  </span>
                  {selectedIds.size >= 2 && (
                    <input
                      type="text"
                      className="w-24 px-2 py-0.5 text-[11px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Add tag to all"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          const tag = e.currentTarget.value.trim()
                          setVideoSlices((current) => {
                            const updated = current.map((s) =>
                              selectedIds.has(s.id)
                                ? {
                                    ...s,
                                    tags: s.tags.includes(tag)
                                      ? s.tags
                                      : [...s.tags, tag]
                                  }
                                : s
                            )
                            localstorage.set(currentVideo.videoURL, updated)
                            return updated
                          })
                          e.currentTarget.value = ""
                        }
                      }}
                    />
                  )}
                </>
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
                    onClick={handleSrtExport}
                    type="button"
                    title="Export SRT">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </button>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    Export SRT
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
                <div className="relative group">
                  <button
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={handleBackupAll}
                    type="button"
                    title="Backup all data">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </button>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    Backup
                  </span>
                </div>
                <div className="relative group">
                  <button
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => backupInputRef.current?.click()}
                    type="button"
                    title="Restore backup">
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
                    Restore
                  </span>
                </div>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleRestoreBackup}
                />
                <div className="relative group">
                  <button
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={handleImportYoutubeChapters}
                    type="button"
                    title="Import YouTube chapters">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    YT Chapters
                  </span>
                </div>
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
              <SliceCard
                key={slice.id}
                slice={slice}
                isDragMode={sortMode === "custom"}
                isDragOver={dragOverId === slice.id}
                isSelected={selectedIds.has(slice.id)}
                isLooping={loopSlices.has(slice.id)}
                borderColor={getTagBorderColor(slice.tags)}
                durationText={formatDuration(slice.endTime - slice.startTime)}
                sortMode={sortMode}
                noteTemplates={noteTemplates}
                onToggleSelect={() => toggleSelection(slice.id)}
                onPlayPause={() => handlePlayOrPause(slice)}
                onReset={() => handleReset(slice)}
                onToggleLoop={() => toggleSliceLoop(slice.id)}
                onRemove={() => removeSlice(slice.id)}
                onDragStart={() => handleDragStart(slice.id)}
                onDragOver={(e) => handleDragOver(e, slice.id)}
                onDrop={(e) => handleDrop(e, slice.id)}
                onDragEnd={handleDragEnd}
                onToggleEdit={() => toggleEdit(slice.id)}
                onSave={() => saveNotes(slice.id)}
                onNoteChange={(e) => handleNoteChange(e, slice.id)}
                onTagsChange={(value) => updateSliceTags(slice.id, value)}
                onAppendNote={(text) => appendToSliceNote(slice.id, text)}
                onInsertImage={() => handleInsertImage(slice.id)}
                onCaptureFrame={() => handleCaptureFrame(slice.id)}
                onInsertTemplate={(e) => handleInsertTemplate(e, slice.id)}
                onTimestampClick={handleSeekTimestamp}
                renderMarkdown={renderMarkdown}
              />
            ))}
          </ul>
        </div>
      )}
      <ShortcutsModal
        show={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  )
}
