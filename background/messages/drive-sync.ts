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
      const result = await uploadBackup(JSON.stringify(allData))
      res.send(result)
      break
    }
    case "download": {
      const result = await downloadBackup()
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
