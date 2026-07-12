import type { PlasmoMessaging } from "@plasmohq/messaging"

import {
  downloadBackup,
  getSyncStatus,
  signOut,
  uploadBackup
} from "~background/drive-sync"

export type RequestBody = {
  action: "upload" | "download" | "status" | "signout"
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (
  req,
  res
) => {
  switch (req.body.action) {
    case "upload": {
      const allData = await chrome.storage.local.get(null)
      const backup = {
        version: 2,
        createdAt: new Date().toISOString(),
        app: "video-notes",
        summary: {
          videoCount: Array.isArray(allData.videoInfos)
            ? allData.videoInfos.length
            : 0,
          totalKeys: Object.keys(allData).length
        },
        data: allData
      }
      const result = await uploadBackup(JSON.stringify(backup, null, 2))
      res.send(result)
      break
    }
    case "download": {
      const result = await downloadBackup()
      if (result?.data) {
        try {
          const parsed = JSON.parse(result.data)
          result.data = JSON.stringify(parsed.data || parsed)
        } catch {
          // keep raw data
        }
      }
      res.send(result)
      break
    }
    case "status": {
      const result = await getSyncStatus()
      res.send(result)
      break
    }
    case "signout": {
      await signOut()
      res.send({ success: true })
      break
    }
    default:
      res.send({ success: false, error: "Unknown action" })
  }
}

export default handler
