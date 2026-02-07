import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = {
  tabId?: number
}

export type RequestResponse = {
  currentTime: number | null
  duration: number | null
}

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  RequestResponse
> = async (req, res) => {
  try {
    let tabId = req.body?.tabId
    if (!tabId) {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      tabId = tabs?.[0]?.id
    }

    if (!tabId) {
      res.send({ currentTime: null, duration: null })
      return
    }

    const result = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const videos = Array.from(
          document.querySelectorAll("video")
        ) as HTMLVideoElement[]

        if (!videos.length) {
          return null
        }

        const preferred =
          videos.find((video) =>
            Number.isFinite(video.duration) && video.duration > 0
          ) ?? videos[0]

        return {
          currentTime: preferred.currentTime,
          duration: preferred.duration
        }
      }
    })

    const match = result
      ?.map((item) => item.result)
      ?.find(
        (item) =>
          item && item.currentTime !== null && item.duration !== null
      )

    res.send(match ?? { currentTime: null, duration: null })
  } catch (error) {
    console.error("Failed to get current time", error)
    res.send({ currentTime: null, duration: null })
  }
}

export default handler