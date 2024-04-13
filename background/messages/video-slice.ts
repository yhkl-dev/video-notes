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
      function onTimeUpdate() {
        if (video.currentTime >= endTime) {
          video.pause()
          video.removeEventListener("timeupdate", onTimeUpdate)
        }
      }

      video.addEventListener("loadedmetadata", () => {
        video.currentTime = startTime
        video.play()
      })

      video.addEventListener("timeupdate", onTimeUpdate)
      video.pause()
    },
    args: [req.body.startTime, req.body.endTime]
  })
}

export default handler
