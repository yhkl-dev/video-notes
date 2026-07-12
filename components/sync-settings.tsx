import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

type SyncState = "idle" | "syncing" | "error" | "success"

export default function SyncSettings() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<SyncState>("idle")
  const [lastSync, setLastSync] = useState<string | null>(
    localStorage.getItem("vn_last_sync")
  )
  const [autoSync, setAutoSync] = useState(
    localStorage.getItem("vn_auto_sync") === "true"
  )
  const [status, setStatus] = useState("")

  useEffect(() => {
    if (!open) return
    sendToBackground({ name: "drive-sync", body: { action: "status" } })
      .then((res: any) => {
        if (res?.lastModified) setLastSync(res.lastModified)
        if (res?.error) setStatus(res.error)
      })
      .catch(() => {})
  }, [open])

  const doSync = async () => {
    setState("syncing")
    setStatus("")
    try {
      const res = await sendToBackground({
        name: "drive-sync",
        body: { action: "upload" }
      })
      if (res?.success) {
        const now = new Date().toISOString()
        localStorage.setItem("vn_last_sync", now)
        setLastSync(now)
        setState("success")
        setTimeout(() => setState("idle"), 2000)
      } else {
        setState("error")
        setStatus(res?.error || "Sync failed")
      }
    } catch {
      setState("error")
      setStatus("Network error")
    }
  }

  const doDownload = async () => {
    setState("syncing")
    setStatus("")
    try {
      const res = await sendToBackground({
        name: "drive-sync",
        body: { action: "download" }
      })
      if (res?.data) {
        const parsed = JSON.parse(res.data)
        let count = 0
        for (const [key, value] of Object.entries(parsed)) {
          await chrome.storage.local.set({ [key]: value })
          count++
        }
        const now = new Date().toISOString()
        localStorage.setItem("vn_last_sync", now)
        setLastSync(now)
        setState("success")
        setStatus(`Restored ${count} items. Reloading...`)
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setState("error")
        setStatus(res?.error || "No backup found")
      }
    } catch {
      setState("error")
      setStatus("Download failed")
    }
  }

  const doSignOut = async () => {
    await sendToBackground({
      name: "drive-sync",
      body: { action: "signout" }
    })
    localStorage.removeItem("vn_last_sync")
    setLastSync(null)
    setStatus("Signed out")
  }

  const toggleAutoSync = () => {
    const next = !autoSync
    setAutoSync(next)
    localStorage.setItem("vn_auto_sync", String(next))
  }

  return (
    <div className="relative">
      <button
        className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setOpen(!open)}
        data-tooltip="Drive Sync">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-40 w-64"
          onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold dark:text-white mb-3">
            Google Drive Sync
          </h3>

          {lastSync && (
            <p className="text-[10px] text-gray-400 mb-2">
              Last sync: {new Date(lastSync).toLocaleString()}
            </p>
          )}

          <div className="space-y-2">
            <button
              className="w-full py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
              onClick={doSync}
              disabled={state === "syncing"}>
              {state === "syncing" ? "Syncing..." : "Upload to Drive"}
            </button>

            <button
              className="w-full py-1.5 text-xs border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={doDownload}>
              Download from Drive
            </button>

            <label className="flex items-center justify-between py-1 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              <span>Auto-sync on change</span>
              <input
                type="checkbox"
                checked={autoSync}
                onChange={toggleAutoSync}
                className="rounded"
              />
            </label>

            <button
              className="w-full py-1.5 text-xs text-red-500 hover:text-red-600 rounded-md transition-colors"
              onClick={doSignOut}>
              Sign Out
            </button>
          </div>

          {status && (
            <p className="text-[10px] text-gray-400 mt-2">{status}</p>
          )}

          {state === "success" && (
            <p className="text-[10px] text-green-500 mt-1">
              Sync completed!
            </p>
          )}
        </div>
      )}
    </div>
  )
}
