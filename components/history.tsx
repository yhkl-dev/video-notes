import { CircleX } from "lucide-react"
import { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import type { VideoResult } from "~types"

const localstorage = new Storage()

export default function History({ setCurrentVideo, setActiveTab }) {
  const [existingVideos, setExistingVideos] = useState([])

  const handleDelete = async (videoToDelete: VideoResult) => {
    const updatedVideos = existingVideos.filter(
      (video: VideoResult) => video.videoURL !== videoToDelete.videoURL
    )
    setExistingVideos(updatedVideos)
    await localstorage.set("videoInfos", updatedVideos)
  }

  const handleClick = async (e: any, existingVideo: VideoResult) => {
    e.preventDefault()
    try {
      await chrome.tabs.update(existingVideo.tabId, {
        active: true
      })
      setCurrentVideo(existingVideo)
      setActiveTab("tab1")
    } catch (e) {
      chrome.tabs
        .create({
          url: existingVideo.videoURL
        })
        .then((newTab) => {
          const updatedVideo = { ...existingVideo, tabId: newTab.id }
          const updatedVideos = existingVideos.map((video) =>
            video.videoURL === existingVideo.videoURL ? updatedVideo : video
          )
          setExistingVideos(updatedVideos)
          localstorage.set("videoInfos", updatedVideos)
          setCurrentVideo(updatedVideo)
          setActiveTab("tab1")
        })
    }
  }

  useEffect(() => {
    const fetchVideos = async () => {
      const existingVideoFromStorage: VideoResult[] =
        await localstorage.get("videoInfos")
      setExistingVideos(existingVideoFromStorage)
    }
    fetchVideos()
  }, [])

  return (
    <div>
      <ul className="mb-4">
        {existingVideos &&
          existingVideos.map((existingVideo, index) => (
            <li
              key={index}
              className="flex bg-gray-50 p-3 mb-2 hover:bg-gray-100 justify-between items-centerrounded-lg transition-colors duration-150 cursor-pointer">
              <a
                href={existingVideo.videoURL}
                className="text-blue-500 hover:text-blue-700"
                title={chrome.i18n.getMessage("hintTitle")}
                onClick={(e) => {
                  handleClick(e, existingVideo)
                }}>
                {existingVideo.tabTitle}
              </a>
              <button
                className="bg-transparent rounded-full"
                onClick={() => handleDelete(existingVideo)}
                title="Delete Video">
                <CircleX className="w-4 h-4" />
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}
