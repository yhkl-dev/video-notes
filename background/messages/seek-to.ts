import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = {
  tabId: number
  time: number
  relative?: boolean
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req) => {
  chrome.scripting
    .executeScript({
      target: { tabId: req.body.tabId },
      func: (time: number, relative: boolean) => {
        const video = document.querySelector("video") as HTMLVideoElement | null
        if (!video) return
        if (relative) {
          video.currentTime = Math.max(0, video.currentTime + time)
        } else {
          video.currentTime = time
        }
      },
      args: [req.body.time, req.body.relative || false]
    })
    .catch(() => {
      // tab may have been closed
    })
}

export default handler
