import clearIconBase64 from "data-base64:~assets/clear.png"
import pauseIconBase64 from "data-base64:~assets/pause.png"
import playIconBase64 from "data-base64:~assets/play.png"
import resetIconBase64 from "data-base64:~assets/reset.png"
import React, { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

import type { VideoInfo, VideoSlice } from "~types"

import "./style.css"

function Popup() {
  const [videoInfo, setVideoInfo] = useState<VideoInfo>({
    url: "",
    duration: 0
  })
  const [url, setURL] = useState<string>("")
  const [videoSlices, setVideoSlices] = useState<VideoSlice[]>([])
  const [tabId, setTabId] = useState<number>(0)

  const [startHour, setStartHour] = useState<string>("00")
  const [startMinute, setStartMinute] = useState<string>("00")
  const [startSecond, setStartSecond] = useState<string>("00")
  const [endHour, setEndHour] = useState<string>("00")
  const [endMinute, setEndMinute] = useState<string>("00")
  const [endSecond, setEndSecond] = useState<string>("00")

  const timeToSeconds = (hours: string, minutes: string, seconds: string) => {
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
  }

  const generateOptions = (range: number) => {
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

  const addSlice = () => {
    const startTimeInSeconds = timeToSeconds(
      startHour,
      startMinute,
      startSecond
    )
    const endTimeInSeconds = timeToSeconds(endHour, endMinute, endSecond)
    if (startTimeInSeconds > endTimeInSeconds) {
      alert("start time cannot greater than end time")
      return
    }
    if (
      startTimeInSeconds > videoInfo.duration ||
      endTimeInSeconds > videoInfo.duration
    ) {
      alert("start time or end time cannot greater than video duration")
      return
    }
    const newSlice = {
      startTime: startTimeInSeconds,
      endTime: endTimeInSeconds,
      startTimeInput: `${startHour}:${startMinute}:${startSecond}`,
      endTimeInput: `${endHour}:${endMinute}:${endSecond}`,
      isPlaying: false
    }

    setVideoSlices([...videoSlices, newSlice])
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
          tabId: tabId,
          isPlay: !slice.isPlaying,
          slice: slice
        }
      })
    } else {
      await sendToBackground({
        name: "pause",
        body: {
          tabId: tabId,
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
        tabId: tabId,
        startTime: slice.startTime,
        endTime: slice.endTime
      }
    })
  }

  const secondsToMinutes = (seconds: number) => {
    return (seconds / 60).toFixed(2)
  }

  const removeSlice = (index: number) => {
    setVideoSlices((currentSlices) =>
      currentSlices.filter((_, idx) => idx !== index)
    )
  }

  const refresh = () => {
    sendToBackground({
      name: "get-video-info"
    }).then((res) => {
      setVideoInfo(res.video)
      setTabId(res.tabId)
      setURL(res.videoURL)
    })
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="p-4 bg-white shadow-lg rounded-lg max-w-md mx-auto w-[500px]">
      {!videoInfo && <div>{chrome.i18n.getMessage("noVideo")}</div>}
      {videoInfo && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {chrome.i18n.getMessage("videoInfo")}
          </h2>
          <p className="mb-2">URL: {url}</p>
          <p className="mb-4">
            {" "}
            {chrome.i18n.getMessage("duration")}:{" "}
            {secondsToMinutes(videoInfo.duration)}
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
                  onChange={(e) => setStartHour(e.target.value)}>
                  {generateOptions(24)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={startMinute}
                  onChange={(e) => setStartMinute(e.target.value)}>
                  {generateOptions(60)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                  value={startSecond}
                  onChange={(e) => setStartSecond(e.target.value)}>
                  {generateOptions(60)}
                </select>
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
                  onChange={(e) => setEndHour(e.target.value)}>
                  {generateOptions(24)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={endMinute}
                  onChange={(e) => setEndMinute(e.target.value)}>
                  {generateOptions(60)}
                </select>
                <select
                  className="mt-1 pl-1 pr-6 py-1 text-xs border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                  value={endSecond}
                  onChange={(e) => setEndSecond(e.target.value)}>
                  {generateOptions(60)}
                </select>
              </div>
            </div>
          </div>
          <button
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors ease-in-out duration-150"
            onClick={addSlice}>
            {chrome.i18n.getMessage("addTimeSegment")}
          </button>
        </div>
      )}
      {videoInfo && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-4">
            {chrome.i18n.getMessage("timeSegment")}
          </h2>
          <ul className="mb-4">
            {videoSlices.map((slice: VideoSlice, index: number) => (
              <li
                className="flex items-center p-3 mb-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                key={index}>
                Start: {slice.startTimeInput} - End: {slice.endTimeInput}
                <img
                  src={slice.isPlaying ? pauseIconBase64 : playIconBase64}
                  alt={slice.isPlaying ? "Play" : "Pause"}
                  className="ml-2 h-6 w-6 cursor-pointer"
                  onClick={() => {
                    handlePlayOrPause(slice, index)
                  }}
                />
                <img
                  src={resetIconBase64}
                  alt="Reset"
                  className="ml-2 h-6 w-6 cursor-pointer"
                  onClick={() => {
                    handleReset(slice, index)
                  }}
                />
                <img
                  src={clearIconBase64}
                  alt="Remove"
                  className="ml-2 h-6 w-6 cursor-pointer"
                  onClick={(e) => {
                    removeSlice(index)
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default Popup
