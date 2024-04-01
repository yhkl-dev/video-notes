import type { PlasmoMessaging } from "@plasmohq/messaging"

import type { VideoSlice } from "~types"

export type RequestBody = {
  isPlay: boolean
  tabId: number
  slice: VideoSlice
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req) => {
  chrome.scripting.executeScript({
    target: { tabId: req.body.tabId },
    func: () => {
      const video = document.querySelector("video")
      video.play()
    }
  })
}

export default handler
