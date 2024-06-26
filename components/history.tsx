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

  const createNewTab = async (existingVideo: VideoResult) => {
    const newTab = await chrome.tabs.create({
      url: existingVideo.videoURL
    })
    const updatedVideo = { ...existingVideo, tabId: newTab.id }
    const updatedVideos = existingVideos.map((video) =>
      video.videoURL === existingVideo.videoURL ? updatedVideo : video
    )
    setExistingVideos(updatedVideos)
    localstorage.set("videoInfos", updatedVideos)
    setCurrentVideo(updatedVideo)
    setActiveTab("tab1")
  }

  const handleClick = async (
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    existingVideo: VideoResult
  ) => {
    console.log("handle click ....")
    e.preventDefault()
    try {
      const currentTabs = await chrome.tabs.query({
        title: existingVideo.tabTitle
      })
      if (currentTabs.length === 0) {
        await createNewTab(existingVideo)
      } else {
        await chrome.tabs.update(existingVideo.tabId, {
          active: true
        })
        setCurrentVideo(existingVideo)
        setActiveTab("tab1")
      }
    } catch (e) {
      await createNewTab(existingVideo)
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  className="lucide lucide-circle-x w-4 h-4">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6" />
                  <path d="m9 9 6 6" />
                </svg>
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}
