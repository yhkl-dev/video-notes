import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = {
  startTime: number
  endTime: number
  tabId: number
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req) => {
  chrome.scripting.executeScript({
    target: { tabId: req.body.tabId },
    func: (startTime: number, endTime: number) => {
      const video = document.querySelector("video")
      video.currentTime = startTime
      video.addEventListener(
        "timeupdate",
        () => {
          if (video.currentTime >= endTime) {
            video.pause()
          }
        },
        { once: true } // only once for timeupdate events, otherwise video will pause when you call is for more 1 time
      )
      video.pause()
    },
    args: [req.body.startTime, req.body.endTime]
  })
}

export default handler
