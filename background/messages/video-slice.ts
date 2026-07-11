import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = {
  startTime: number
  endTime: number
  tabId: number
  loop?: boolean
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req) => {
  chrome.scripting
    .executeScript({
      target: { tabId: req.body.tabId },
      func: (startTime: number, endTime: number, loop: boolean) => {
        const video = document.querySelector("video") as HTMLVideoElement | null
        if (!video) return
        const prev = (video as any).__vnSliceHandler as (() => void) | undefined
        if (prev) video.removeEventListener("timeupdate", prev)
        function onTimeUpdate() {
          if (video.currentTime >= endTime) {
            if (loop) {
              video.currentTime = startTime
              video.play()
            } else {
              video.pause()
              video.removeEventListener("timeupdate", onTimeUpdate)
              delete (video as any).__vnSliceHandler
            }
          }
        }
        ;(video as any).__vnSliceHandler = onTimeUpdate
        video.addEventListener("timeupdate", onTimeUpdate)
        video.currentTime = startTime
        video.play()
      },
      args: [req.body.startTime, req.body.endTime, req.body.loop || false]
    })
    .catch(() => {
      // tab may have been closed
    })
}

export default handler
