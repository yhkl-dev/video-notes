import pauseIconBase64 from "data-base64:~assets/pause.png"
import playIconBase64 from "data-base64:~assets/play.png"
import React, { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import "./style.css"

function Popup() {
  const storage = new Storage()

  const [videoInfo, setVideoInfo] = useState(null)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [videoSlices, setVideoSlices] = useState([])

  const addSlice = () => {
    setVideoSlices([...videoSlices, { startTime, endTime, isPlaying: false }])
  }

  const handleSetTime = async (slice, index) => {
    setVideoSlices(
      videoSlices.map((slice, idx) => {
        if (idx === index) {
          return { ...slice, isPlaying: !slice.isPlaying }
        }
        return slice
      })
    )
    await sendToBackground({
      name: "video-slice",
      body: {
        startTime: slice.startTime,
        endTime: slice.endTime
      }
    })
  }

  const secondsToMinutes = (seconds) => {
    return (seconds / 60).toFixed(2)
  }

  useEffect(() => {
    storage.get("videoInfo").then((data) => {
      setVideoInfo(data[0].result)
    })
  }, [])

  return (
    <div className="p-4 bg-white shadow-lg rounded-lg max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">时间段</h2>
      <ul className="mb-4">
        {videoSlices.map((slice, index) => (
          <li
            className="flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            key={index}
            onClick={() => handleSetTime(slice, index)}>
            开始时间: {secondsToMinutes(slice.startTime)} 分钟, 结束时间:{" "}
            {secondsToMinutes(slice.endTime)} 分钟
            <img
              src={slice.isPlaying ? pauseIconBase64 : playIconBase64}
              alt={slice.isPlaying ? "Pause" : "Play"}
              className="ml-2 h-6 w-6"
            />
          </li>
        ))}
      </ul>

      {videoInfo && (
        <div>
          <h2 className="text-xl font-semibold mb-4">视频信息</h2>
          <p className="mb-2">URL: {videoInfo.url}</p>
          <p className="mb-4">时长: {secondsToMinutes(videoInfo.duration)}</p>
          <div className="flex gap-2 mb-4">
            <input
              type="number"
              value={startTime}
              className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              onChange={(e) => setStartTime(e.target.value)}
            />
            <input
              type="number"
              value={endTime}
              className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <button
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors ease-in-out duration-150"
            onClick={addSlice}>
            添加时间段
          </button>
        </div>
      )}
    </div>
  )
}

export default Popup
