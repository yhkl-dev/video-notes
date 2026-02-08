import clearIconBase64 from "data-base64:~assets/clear.png"
import pauseIconBase64 from "data-base64:~assets/pause.png"
import playIconBase64 from "data-base64:~assets/play.png"
import resetIconBase64 from "data-base64:~assets/reset.png"
import { useEffect, useMemo, useState } from "react"
import type { ChangeEvent, DragEvent } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import type { DragEvent } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import type { VideoResult, VideoSlice } from "~types"
import { useToast } from "~components/toast"

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
      addToast(
        chrome.i18n.getMessage("errorInvalidTimeFormat"),
        "error"
      )
      return
    }
    setStartFromSeconds(seconds)
  }

  const applyEndTimeInput = () => {
    const seconds = parseTimeInput(endTimeInput)
    if (seconds === null) {
      addToast(
        chrome.i18n.getMessage("errorInvalidTimeFormat"),
        "error"
      )
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
      const fromIndex = currentSlices.findIndex((slice) => slice.id === sourceId)
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
    setVideoSlices((currentSlices) =>
      currentSlices.map((slice) => {
        if (slice.id === id) {
          return { ...slice, note: updater(slice.note || "") }
        }
        return slice
      })
    )
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
    const template = noteTemplates.find((item) => item.key === event.target.value)
    if (template) {
      appendToSliceNote(id, template.snippet)
      event.target.value = ""
    }
  }

  const handleInsertImage = (id: string) => {
    const url = window.prompt(chrome.i18n.getMessage("promptImageUrl"))
    if (!url) return
    const snippet = `![Image](${url})`
    appendToSliceNote(id, snippet)
  }

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) {
      addToast(chrome.i18n.getMessage("errorNoSelection"), "error")
      return
    }
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
    URL.revokeObjectURL(url)
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

  const renderMarkdown = (text: string) => {
    return DOMPurify.sanitize(marked(text))
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
      addToast(
        chrome.i18n.getMessage("errorStartGreaterThanEnd"),
        "error"
      )
      return
    }
    if (
      startTimeInSeconds > currentVideo.video.duration ||
      endTimeInSeconds > currentVideo.video.duration
    ) {
      addToast(
        chrome.i18n.getMessage("errorTimeExceedsDuration"),
        "error"
      )
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
          isPlay: !slice.isPlaying,
          slice: slice
        }
      })
    } else {
      await sendToBackground({
        name: "pause",
        body: {
          tabId: currentVideo.tabId,
          isPlay: !slice.isPlaying,
          slice: slice
        }
      })
    }
  }

  const handleReset = async (slice: VideoSlice) => {
    setVideoSlices((currentSlices) =>
      currentSlices.map((s) => {
        if (s.id === slice.id) {
          return { ...s, isPlaying: false }
        }
        return s
      })
    )
    await sendToBackground({
      name: "video-slice",
      body: {
        tabId: currentVideo.tabId,
        startTime: slice.startTime,
        endTime: slice.endTime
      }
    })
  }

  const secondsToMinutes = (seconds: number) => {
    return (seconds / 60).toFixed(2)
  }

  const removeSlice = (id: string) => {
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

  useEffect(() => {
    const getCurrentVideoSlice = async (currentVideo: VideoResult) => {
      const res: VideoSlice[] = await localstorage.get(currentVideo.videoURL)
      if (res) {
        const normalized = res.map((slice) => normalizeSlice(slice))
        setVideoSlices(normalized)
        setSelectedIds(new Set())
        const needsSave = res.some(
          (slice) => !slice.id || !slice.createdAt || !slice.tags
        )
        if (needsSave) {
          await localstorage.set(currentVideo.videoURL, normalized)
        }
      }
    }
    getCurrentVideoSlice(currentVideo)
  }, [currentVideo])

  return (
    <>
      {!currentVideo.video && (
        <div className="flex flex-col items-center justify-center p-4">
          <p className="text-gray-600 text-lg mb-2">
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
          <h2 className="text-xl font-semibold mb-4 flex items-center">
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
          <p className="mb-2">
            {chrome.i18n.getMessage("videoName")}:{" "}
            <a
              href={currentVideo.videoURL}
              className="text-blue-500 hover:text-blue-700"
              title={chrome.i18n.getMessage("hintTitle")}
              onClick={(e) => {
                e.preventDefault()
                chrome.tabs.update(currentVideo.tabId, { active: true })
              }}>
              {currentVideo.tabTitle}
            </a>
          </p>
          <p className="mb-4">
            {" "}
            {chrome.i18n.getMessage("duration")}:{" "}
            {secondsToMinutes(currentVideo.video.duration)}
          </p>
          <div className="flex justify-between items-end mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                {chrome.i18n.getMessage("startTime")}
              </label>
              <div className="flex">
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
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
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={startMinute}
                  onChange={(e) =>
                    updateStartFromParts(
                      startHour,
                      e.target.value,
                      startSecond
                    )
                  }>
                  {generateOptions(60)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                  value={startSecond}
                  onChange={(e) =>
                    updateStartFromParts(
                      startHour,
                      startMinute,
                      e.target.value
                    )
                  }>
                  {generateOptions(60)}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  className="w-24 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
              <label className="block text-xs font-medium text-gray-700">
                {chrome.i18n.getMessage("endTime")}
              </label>
              <div className="flex gap-1">
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                  value={endHour}
                  onChange={(e) =>
                    updateEndFromParts(e.target.value, endMinute, endSecond)
                  }>
                  {generateOptions(24)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-24 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
            <label className="block text-xs font-medium text-gray-700 mb-2">
              {chrome.i18n.getMessage("timeRange")}
            </label>
            <div className="flex flex-col gap-2">
              <input
                type="range"
                min={0}
                max={Math.floor(currentVideo.video.duration || 0)}
                value={Math.min(
                  timeToSeconds(startHour, startMinute, startSecond),
                  timeToSeconds(endHour, endMinute, endSecond)
                )}
                onChange={(e) => {
                  const nextValue = Number(e.target.value)
                  const endValue = timeToSeconds(endHour, endMinute, endSecond)
                  setStartFromSeconds(Math.min(nextValue, endValue))
                }}
              />
              <input
                type="range"
                min={0}
                max={Math.floor(currentVideo.video.duration || 0)}
                value={Math.max(
                  timeToSeconds(startHour, startMinute, startSecond),
                  timeToSeconds(endHour, endMinute, endSecond)
                )}
                onChange={(e) => {
                  const nextValue = Number(e.target.value)
                  const startValue = timeToSeconds(
                    startHour,
                    startMinute,
                    startSecond
                  )
                  setEndFromSeconds(Math.max(nextValue, startValue))
                }}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  {formatTimeInput(
                    timeToSeconds(startHour, startMinute, startSecond)
                  )}
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
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out flex items-center justify-center"
            onClick={addSlice}>
            <svg
              className="w-5 h-5 mr-2"
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
        </div>
      )}
      {currentVideo.video && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center ">
            {chrome.i18n.getMessage("timeSegment")}
          </h2>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={chrome.i18n.getMessage("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <input
                type="text"
                className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={chrome.i18n.getMessage("tagFilterPlaceholder")}
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              />
              <select
                className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
            </div>
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              <strong>💡 {chrome.i18n.getMessage("tip")}:</strong> {chrome.i18n.getMessage("searchHint")}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                className="text-blue-600 hover:text-blue-800"
                onClick={selectAllVisible}
                type="button">
                {chrome.i18n.getMessage("selectAll")}
              </button>
              <button
                className="text-blue-600 hover:text-blue-800"
                onClick={clearSelection}
                type="button">
                {chrome.i18n.getMessage("clearSelection")}
              </button>
              <span className="text-gray-500">
                {chrome.i18n
                  .getMessage("selectedCount")
                  .replace("{count}", selectedIds.size.toString())}
              </span>
              <button
                className="text-red-600 hover:text-red-800"
                onClick={handleBatchDelete}
                type="button">
                {chrome.i18n.getMessage("deleteSelected")}
              </button>
              <button
                className="text-green-600 hover:text-green-800"
                onClick={handleBatchExport}
                type="button">
                {chrome.i18n.getMessage("exportSelected")}
              </button>
              <button
                className="text-purple-600 hover:text-purple-800"
                onClick={handleMergeSelected}
                type="button">
                {chrome.i18n.getMessage("mergeSelected")}
              </button>
            </div>
          </div>
          <ul>
            {filteredSlices.map((slice: VideoSlice) => (
              <li
                key={slice.id}
                className={`flex flex-col p-3 mb-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150 ${
                  sortMode === "custom" ? "cursor-move" : "cursor-pointer"
                } ${dragOverId === slice.id ? "ring-2 ring-blue-400" : ""}`}
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
                      Start: {slice.startTimeInput} - End: {slice.endTimeInput}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <img
                      src={slice.isPlaying ? pauseIconBase64 : playIconBase64}
                      alt={slice.isPlaying ? "Pause" : "Play"}
                      className="ml-2 h-6 w-6 cursor-pointer"
                      onClick={() => handlePlayOrPause(slice)}
                    />
                    <img
                      src={resetIconBase64}
                      alt="Reset"
                      className="ml-2 h-6 w-6 cursor-pointer"
                      onClick={() => handleReset(slice)}
                    />
                    <img
                      src={clearIconBase64}
                      alt="Remove"
                      className="ml-2 h-6 w-6 cursor-pointer"
                      onClick={() => removeSlice(slice.id)}
                    />
                  </div>
                </div>
                {slice.editing ? (
                  <>
                    <div className="flex flex-wrap gap-2 text-xs mt-2">
                      <span className="text-gray-500">
                        {chrome.i18n.getMessage("noteToolbar")}
                      </span>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-200"
                        onClick={() => appendToSliceNote(slice.id, "**bold text**")}
                      >
                        {chrome.i18n.getMessage("boldLabel")}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-200"
                        onClick={() => appendToSliceNote(slice.id, "*italic text*")}
                      >
                        {chrome.i18n.getMessage("italicLabel")}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-200"
                        onClick={() =>
                          appendToSliceNote(slice.id, "```\ncode block\n```")
                        }
                      >
                        {chrome.i18n.getMessage("codeLabel")}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-200"
                        onClick={() => handleInsertImage(slice.id)}
                      >
                        {chrome.i18n.getMessage("insertImage")}
                      </button>
                      <select
                        className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none"
                        defaultValue=""
                        onChange={(event) => handleInsertTemplate(event, slice.id)}>
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
                      className="mt-2 p-3 border border-gray-200 rounded-lg shadow-lg transition-shadow duration-300 ease-in-out focus:border-blue-400 focus:ring focus:ring-blue-300 focus:ring-opacity-50 w-full"
                      value={slice.note || ""}
                      onChange={(e) => handleNoteChange(e, slice.id)}
                    />
                  </>
                ) : slice.note && slice.note.trim() ? (
                  <div
                    className="mt-2 p-3 bg-gray-100 rounded-lg shadow markdown-preview text-sm"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(slice.note) }}
                  />
                ) : (
                  <p className="p-3 bg-gray-100 rounded-lg shadow text-sm text-gray-500">
                    {chrome.i18n.getMessage("noNotes")}
                  </p>
                )}
                {slice.editing ? (
                  <input
                    type="text"
                    className="mt-2 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                <div className="flex justify-between mt-2 space-x-2">
                  <button
                    className="bg-transparent rounded-full"
                    onClick={() => toggleEdit(slice.id)}>
                    {slice.editing ? (
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
                          d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    ) : (
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
                        className="w-4 h-4">
                        <path d="m18 5-3-3H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2" />
                        <path d="M8 18h1" />
                        <path d="M18.4 9.6a2 2 0 1 1 3 3L17 17l-4 1 1-4Z" />
                      </svg>
                    )}
                  </button>
                  {slice.editing && (
                    <button
                      // className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out flex items-center hover:shadow-lg"
                      className="bg-transparent rounded-full bg-green-500 hover:bg-green-700  transition duration-200 ease-in-out flex items-center hover:shadow-lg"
                      onClick={() => saveNotes(slice.id)}>
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
                          d="M5 13l4 4L19 7"></path>
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
