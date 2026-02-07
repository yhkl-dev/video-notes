import clearIconBase64 from "data-base64:~assets/clear.png"
import pauseIconBase64 from "data-base64:~assets/pause.png"
import playIconBase64 from "data-base64:~assets/play.png"
import resetIconBase64 from "data-base64:~assets/reset.png"
import { useEffect, useState, useMemo } from "react"

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
  const { addToast } = useToast()

  const timeToSeconds = (hours: string, minutes: string, seconds: string) => {
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
  }

  const pad2 = (value: number) => value.toString().padStart(2, "0")

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

  const handleNoteChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    index: number
  ) => {
    const newNote = event.target.value
    setVideoSlices((currentSlices) =>
      currentSlices.map((slice, idx) => {
        if (idx === index) {
          return { ...slice, note: newNote }
        }
        return slice
      })
    )
  }

  const toggleEdit = (index: number) => {
    setVideoSlices((currentSlices) =>
      currentSlices.map((slice, idx) => {
        if (idx === index) {
          return { ...slice, editing: !slice.editing }
        }
        return slice
      })
    )
  }

  const saveNotes = (index: number) => {
    setVideoSlices((currentSlices) => {
      const updatedSlices = currentSlices.map((slice, idx) => {
        if (idx === index) {
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
    const newSlice = {
      startTime: startTimeInSeconds,
      endTime: endTimeInSeconds,
      startTimeInput: `${startHour}:${startMinute}:${startSecond}`,
      endTimeInput: `${endHour}:${endMinute}:${endSecond}`,
      isPlaying: false,
      note: "",
      editing: false
    }
    const updatedSlices: VideoSlice[] = [...videoSlices, newSlice]
    setVideoSlices(updatedSlices)
    await localstorage.set(currentVideo.videoURL, updatedSlices)
    addToast(chrome.i18n.getMessage("successSegmentAdded"), "success")
  }

  const handlePlayOrPause = async (slice: VideoSlice, index: number) => {
    setVideoSlices((currentSlices) =>
      currentSlices.map((s, idx) => {
        if (idx === index) {
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

  const handleReset = async (slice: VideoSlice, index: number) => {
    setVideoSlices((currentSlices) =>
      currentSlices.map((s, idx) => {
        if (idx === index) {
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

  const removeSlice = (index: number) => {
    setVideoSlices((currentSlices) => {
      const updatedSlices = currentSlices.filter((_, idx) => idx !== index)
      localstorage.set(currentVideo.videoURL, updatedSlices)
      return updatedSlices
    })
  }

  useEffect(() => {
    const getCurrentVideoSlice = async (currentVideo: VideoResult) => {
      const res: VideoSlice[] = await localstorage.get(currentVideo.videoURL)
      if (res) {
        setVideoSlices(res)
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
          <ul>
            {videoSlices.map((slice: VideoSlice, index: number) => (
              <li
                key={index}
                className="flex flex-col p-3 mb-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    Start: {slice.startTimeInput} - End: {slice.endTimeInput}
                  </div>
                  <div className="flex items-center">
                    <img
                      src={slice.isPlaying ? pauseIconBase64 : playIconBase64}
                      alt={slice.isPlaying ? "Pause" : "Play"}
                      className="ml-2 h-6 w-6 cursor-pointer"
                      onClick={() => handlePlayOrPause(slice, index)}
                    />
                    <img
                      src={resetIconBase64}
                      alt="Reset"
                      className="ml-2 h-6 w-6 cursor-pointer"
                      onClick={() => handleReset(slice, index)}
                    />
                    <img
                      src={clearIconBase64}
                      alt="Remove"
                      className="ml-2 h-6 w-6 cursor-pointer"
                      onClick={() => removeSlice(index)}
                    />
                  </div>
                </div>
                {slice.editing ? (
                  <textarea
                    className="mt-2 p-3 border border-gray-200 rounded-lg shadow-lg transition-shadow duration-300 ease-in-out focus:border-blue-400 focus:ring focus:ring-blue-300 focus:ring-opacity-50 w-full"
                    value={slice.note || ""}
                    onChange={(e) => handleNoteChange(e, index)}
                  />
                ) : (
                  <p className="p-3 bg-gray-100 rounded-lg shadow">
                    {slice.note || "No notes"}
                  </p>
                )}
                <div className="flex justify-between mt-2 space-x-2">
                  <button
                    className="bg-transparent rounded-full"
                    onClick={() => toggleEdit(index)}>
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
                      onClick={() => saveNotes(index)}>
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
