import type { PlasmoMessaging } from "@plasmohq/messaging"

import type { VideoSlice } from "~types"

export type RequestBody = {
  isPlay: boolean
  tabId: number
  slice: VideoSlice
  loop?: boolean
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req) => {
  chrome.scripting
    .executeScript({
      target: { tabId: req.body.tabId },
      func: (startTime: number, endTime: number, loop: boolean) => {
        const video = document.querySelector("video") as HTMLVideoElement | null
        if (!video) return
        const prev = (video as any).__vnLoopHandler as (() => void) | undefined
        if (prev) {
          video.removeEventListener("timeupdate", prev)
          delete (video as any).__vnLoopHandler
        }
        if (loop) {
          function onTimeUpdate() {
            if (video.currentTime >= endTime) {
              video.currentTime = startTime
              video.play()
            }
          }
          ;(video as any).__vnLoopHandler = onTimeUpdate
          video.addEventListener("timeupdate", onTimeUpdate)
        }
        video.currentTime = startTime
        video.play()
      },
      args: [
        req.body.slice.startTime,
        req.body.slice.endTime,
        req.body.loop || false
      ]
    })
    .catch(() => {
      // tab may have been closed
    })
}

export default handler
