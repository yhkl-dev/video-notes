import { Moon, Sun } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import History from "~components/history"
import Home from "~components/home"
import { ToastProvider } from "~components/toast"
import type { VideoResult } from "~types"

import "~style.css"

const localstorage = new Storage()

type Theme = "light" | "dark"

function getSystemTheme(): Theme {
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark"
  }
  return "light"
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

export default function AppShell() {
  const [activeTab, setActiveTab] = useState("tab1")
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme") as Theme | null
    if (saved === "light" || saved === "dark") return saved
    return getSystemTheme()
  })
  const [currentVideo, setCurrentVideo] = useState<VideoResult>({
    tabId: 0,
    tabTitle: "",
    videoURL: "",
    video: {
      url: "",
      duration: 0
    }
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      const saved = localStorage.getItem("theme")
      if (!saved) {
        setTheme(getSystemTheme())
      }
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  const setToLocalStorage = async (res: VideoResult) => {
    const stored = await localstorage.get("videoInfos")
    const videoInfos: VideoResult[] = Array.isArray(stored) ? stored : []

    if (!videoInfos.some((video) => video.videoURL === res.videoURL)) {
      videoInfos.push(res)
      await localstorage.set("videoInfos", videoInfos)
    }
  }

  const refresh = useCallback(() => {
    sendToBackground({
      name: "get-video-info"
    })
      .then((res) => {
        setCurrentVideo(res)
        if (res.video) {
          setToLocalStorage(res)
        }
      })
      .catch(() => {
        // tab may have been closed or message failed
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [])

  return (
    <ToastProvider>
      <div className="p-4 bg-white dark:bg-gray-900 min-h-screen">
        <div>
          <div className="flex border-b dark:border-gray-700 items-center justify-between">
            <div className="flex">
              <button
                className={`py-2 px-4 text-sm font-medium ${activeTab === "tab1" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"}`}
                onClick={() => setActiveTab("tab1")}>
                {chrome.i18n.getMessage("home")}
              </button>
              <button
                className={`py-2 px-4 text-sm font-medium ${activeTab === "tab2" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"}`}
                onClick={() => setActiveTab("tab2")}>
                {chrome.i18n.getMessage("history")}
              </button>
            </div>
            <button
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={toggleTheme}
              title={chrome.i18n.getMessage("darkMode")}>
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
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
    </ToastProvider>
  )
}
