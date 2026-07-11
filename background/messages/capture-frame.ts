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
  try {
    const dataUrl: string = await (chrome.tabs.captureVisibleTab as any)(null, {
      format: "jpeg",
      quality: 30
    })
    res.send({ dataUrl })
  } catch {
    res.send({ dataUrl: null })
  }
}

export default handler
