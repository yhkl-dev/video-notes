import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = {
  tabId: number
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
      target: { tabId },
      func: () => {
        const video = document.querySelector("video") as
          | HTMLVideoElement
          | null
        if (!video) {
          return { currentTime: null, duration: null }
        }
        return {
          currentTime: video.currentTime,
          duration: video.duration
        }
      }
    })

    res.send(result?.[0]?.result ?? { currentTime: null, duration: null })
  } catch (error) {
    console.error("Failed to get current time", error)
    res.send({ currentTime: null, duration: null })
  }
}

export default handler