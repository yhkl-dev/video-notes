import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = {
  startTime: number
  endTime: number
  tabId: number
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req) => {
  chrome.scripting
    .executeScript({
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
          { once: true }
        )
      },
      args: [req.body.startTime, req.body.endTime]
    })
    .then((res) => {
      console.log("res", res)
    })
}

export default handler
