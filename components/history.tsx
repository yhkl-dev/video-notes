import { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import type { VideoResult } from "~types"

const localstorage = new Storage()

export default function History({
  setCurrentVideo,
  setActiveTab
}: {
  setCurrentVideo: (video: VideoResult) => void
  setActiveTab: (tab: string) => void
}) {
  const [existingVideos, setExistingVideos] = useState<VideoResult[]>([])

  const handleDelete = async (videoToDelete: VideoResult) => {
    const updatedVideos = existingVideos.filter(
      (video) => video.videoURL !== videoToDelete.videoURL
    )
    setExistingVideos(updatedVideos)
    await localstorage.set("videoInfos", updatedVideos)
  }

  const createNewTab = async (existingVideo: VideoResult) => {
    try {
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
    } catch {
      // popup blocked or tab creation failed
    }
  }

  const handleClick = async (
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    existingVideo: VideoResult
  ) => {
    e.preventDefault()
    try {
      const currentTabs = await chrome.tabs.query({
        url: existingVideo.videoURL
      })
      const match = currentTabs[0]
      if (match?.id) {
        await chrome.tabs.update(match.id, { active: true })
        setCurrentVideo({ ...existingVideo, tabId: match.id })
        setActiveTab("tab1")
      } else {
        await createNewTab(existingVideo)
      }
    } catch {
      await createNewTab(existingVideo)
    }
  }

  useEffect(() => {
    const fetchVideos = async () => {
      const stored = await localstorage.get("videoInfos")
      setExistingVideos(Array.isArray(stored) ? stored : [])
    }
    fetchVideos()
  }, [])

  return (
    <div>
      <ul className="mb-4">
        {existingVideos.map((existingVideo, index) => (
          <li
            key={index}
            className="flex bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 p-3.5 mb-2 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm justify-between items-center rounded-xl transition-all duration-200 cursor-pointer">
            <a
              href={existingVideo.videoURL}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
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
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
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
