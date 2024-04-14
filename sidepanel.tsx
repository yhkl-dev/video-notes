import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import History from "~components/history"
import Home from "~components/home"
import type { VideoResult } from "~types"

import "./style.css"

const localstorage = new Storage()

function Popup() {
  const [activeTab, setActiveTab] = useState("tab1")
  const [currentVideo, setCurrentVideo] = useState<VideoResult>({
    tabId: 0,
    tabTitle: "",
    videoURL: "",
    video: {
      url: "",
      duration: 0
    }
  })

  const setToLocalStorage = async (res: VideoResult) => {
    const existingVideos: VideoResult[] = await localstorage.get("videoInfos")
    const videoInfos = existingVideos ? existingVideos : []

    if (!videoInfos.some((video) => video.videoURL === res.videoURL)) {
      videoInfos.push(res)
      await localstorage.set("videoInfos", videoInfos)
    }
  }

  const refresh = () => {
    sendToBackground({
      name: "get-video-info"
    }).then((res) => {
      setCurrentVideo(res)
      if (res.video) {
        setToLocalStorage(res)
      }
    })
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="p-4 bg-white">
      <div>
        <div className="flex border-b">
          <button
            className={`py-2 px-4 text-sm font-medium ${activeTab === "tab1" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 hover:text-blue-500"}`}
            onClick={() => setActiveTab("tab1")}>
            {chrome.i18n.getMessage("home")}
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium ${activeTab === "tab2" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 hover:text-blue-500"}`}
            onClick={() => setActiveTab("tab2")}>
            {chrome.i18n.getMessage("history")}
          </button>
        </div>
        <div className="p-4">
          {activeTab === "tab1" && (
            <Home currentVideo={currentVideo} refresh={refresh}></Home>
          )}
          {activeTab === "tab2" && (
            <History
              setCurrentVideo={setCurrentVideo}
              setActiveTab={setActiveTab}></History>
          )}
        </div>
      </div>
    </div>
  )
}

export default Popup
