import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = {
  tabId: number
}

export type ResponseBody = {
  dataUrl: string | null
}

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const tabId = req.body.tabId

  try {
    const [scriptResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const video = document.querySelector("video") as HTMLVideoElement | null
        if (!video || video.readyState < 1) return null
        if (video.videoWidth === 0 || video.videoHeight === 0) return null
        try {
          const maxW = 640
          const scale = Math.min(1, maxW / video.videoWidth)
          const canvas = document.createElement("canvas")
          canvas.width = Math.round(video.videoWidth * scale)
          canvas.height = Math.round(video.videoHeight * scale)
          const ctx = canvas.getContext("2d")
          if (!ctx) return null
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          return canvas.toDataURL("image/jpeg", 0.6)
        } catch {
          return null
        }
      }
    })

    if (scriptResult?.result && typeof scriptResult.result === "string") {
      res.send({ dataUrl: scriptResult.result })
      return
    }
  } catch {
    // canvas approach failed, try captureVisibleTab
  }

  try {
    const win = await chrome.windows.getCurrent()
    const dataUrl = await chrome.tabs.captureVisibleTab(win.id, {
      format: "jpeg",
      quality: 50
    })
    res.send({ dataUrl })
  } catch {
    res.send({ dataUrl: null })
  }
}

export default handler
