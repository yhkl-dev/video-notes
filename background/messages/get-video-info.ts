import type { PlasmoMessaging } from "@plasmohq/messaging"

import type { VideoInfo } from "~types"

export type RequestBody = {
  startTime: number
  endTime: number
}

export type RequestResponse = {
  tabId: number
  tabTitle: string
  videoURL: string
  video: VideoInfo | null
}

function getVideoInfo(): VideoInfo | null {
  const video = document.querySelector("video") as HTMLVideoElement | null
  if (video) {
    return {
      url: video.src || "",
      duration: video.duration || 0
    }
  }
  console.warn("No video element found on the page")
  return null
}

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  RequestResponse
> = async (req, res) => {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || tabs.length === 0) {
        console.error("No active tab found")
        res.send({
          tabId: 0,
          tabTitle: "",
          videoURL: "",
          video: null
        })
        return
      }

      const currentTabId = tabs[0].id
      if (currentTabId === undefined) {
        console.error("Tab ID is undefined")
        res.send({
          tabId: 0,
          tabTitle: "",
          videoURL: "",
          video: null
        })
        return
      }

      chrome.scripting
        .executeScript({
          target: { tabId: currentTabId },
          func: getVideoInfo
        })
        .then((resp) => {
          if (!resp || resp.length === 0) {
            console.error("Failed to execute script on tab")
            res.send({
              tabId: currentTabId,
              tabTitle: tabs[0].title || "",
              videoURL: tabs[0].url || "",
              video: null
            })
            return
          }

          res.send({
            tabId: currentTabId,
            tabTitle: tabs[0].title || "",
            videoURL: tabs[0].url || "",
            video: resp[0].result
          })
        })
        .catch((error) => {
          console.error("Error executing script:", error)
          res.send({
            tabId: currentTabId,
            tabTitle: tabs[0].title || "",
            videoURL: tabs[0].url || "",
            video: null
          })
        })
    })
  } catch (error) {
    console.error("Error in get-video-info handler:", error)
    res.send({
      tabId: 0,
      tabTitle: "",
      videoURL: "",
      video: null
    })
  }
}

export default handler
