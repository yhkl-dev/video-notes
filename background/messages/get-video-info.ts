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
  video: VideoInfo
}

function getVideoInfo(): VideoInfo {
  const video = document.querySelector("video")
  if (video) {
    return {
      url: video.src,
      duration: video.duration
    }
  }
  return null
}

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  RequestResponse
> = async (req, res) => {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var currentTabId = tabs[0].id
    tabs[0].title
    chrome.scripting
      .executeScript({
        target: { tabId: currentTabId },
        func: getVideoInfo
      })
      .then((resp) => {
        res.send({
          tabId: currentTabId,
          tabTitle: tabs[0].title,
          videoURL: tabs[0].url,
          video: resp[0].result
        })
      })
  })
}

export default handler
