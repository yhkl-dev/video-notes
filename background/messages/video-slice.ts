import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

export type RequestBody = {
  startTime: number
  endTime: number
}

export type RequestResponse = number

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  RequestResponse
> = async (req, res) => {
  console.log(req.body.startTime)
  console.log(req.body.endTime)
  const storage = new Storage()

  const tabId = (await storage.get("tabId")) as number
  chrome.scripting
    .executeScript({
      target: { tabId: tabId },
      func: (startTime, endTime) => {
        const video = document.querySelector("video")
        video.currentTime = startTime
        video.addEventListener("timeupdate", () => {
          if (video.currentTime >= endTime) {
            video.pause()
          }
        })
        video.play()
        return video.src
      },
      args: [req.body.startTime, req.body.endTime]
    })
    .then((res) => {
      console.log("res", res)
    })
}

export default handler
