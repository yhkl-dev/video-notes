import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

import { normalizeVideoURL } from "~components/utils"

type SyncStatus = "disconnected" | "connected" | "syncing" | "error"

export default function SyncSettings({
  onRefresh,
  onRestore
}: {
  onRefresh?: () => void
  onRestore?: (videos: Array<{ title: string; url: string }>) => void
}) {
  const [open, setOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("disconnected")
  const [lastSync, setLastSync] = useState<string | null>(
    localStorage.getItem("vn_last_sync")
  )
  const [autoSync, setAutoSync] = useState(
    localStorage.getItem("vn_auto_sync") !== "false"
  )
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState<string | null>(null)
  const [progress, setProgress] = useState("")

  useEffect(() => {
    if (!open) return
    setProgress("Checking Drive...")
    sendToBackground({ name: "drive-sync", body: { action: "status" } })
      .then((res: any) => {
        if (res?.email) setEmail(res.email)
        if (res?.lastModified) setLastSync(res.lastModified)
        setSyncStatus(res?.error ? "error" : "connected")
        setProgress("")
        if (res?.error) setMessage(res.error)
      })
      .catch(() => {
        setSyncStatus("error")
        setMessage("Connection failed")
        setProgress("")
      })
  }, [open])

  const handleConnect = async () => {
    setSyncStatus("syncing")
    setMessage("")
    setProgress("Authenticating with Google...")
    try {
      const res = await sendToBackground({
        name: "drive-sync",
        body: { action: "upload" }
      })
      if (res?.success) {
        const now = new Date().toISOString()
        localStorage.setItem("vn_last_sync", now)
        setLastSync(now)
        setSyncStatus("connected")
        setProgress("")
        setMessage("Connected! Data saved to your Google Drive.")
      } else {
        setSyncStatus("error")
        setProgress("")
        setMessage(
          res?.error || "Auth failed. Check your Google Cloud Console setup."
        )
      }
    } catch {
      setSyncStatus("error")
      setProgress("")
      setMessage("Network error")
    }
  }

  const handleSync = async () => {
    setSyncStatus("syncing")
    setMessage("")
    setProgress("Collecting data...")
    try {
      await new Promise((r) => setTimeout(r, 200))
      setProgress("Uploading to Google Drive...")
      const res = await sendToBackground({
        name: "drive-sync",
        body: { action: "upload" }
      })
      if (res?.success) {
        const now = new Date().toISOString()
        localStorage.setItem("vn_last_sync", now)
        setLastSync(now)
        setSyncStatus("connected")
        setProgress("")
        setMessage("Synced to Google Drive")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setSyncStatus("error")
        setProgress("")
        setMessage(res?.error || "Sync failed")
      }
    } catch {
      setSyncStatus("error")
      setProgress("")
      setMessage("Network error")
    }
  }

  const handleRestore = async () => {
    if (
      !confirm(
        "This will replace all local data with the cloud backup. Continue?"
      )
    )
      return
    setSyncStatus("syncing")
    setMessage("")
    setProgress("Downloading from Google Drive...")
    try {
      const res = await sendToBackground({
        name: "drive-sync",
        body: { action: "download" }
      })
      if (res?.data) {
        setProgress("Restoring data...")
        const parsed = JSON.parse(res.data)
        const data = parsed.data || parsed
        for (const [key, value] of Object.entries(data)) {
          await chrome.storage.local.set({ [key]: value })
        }
        const merged: Record<string, any> = {}
        if (Array.isArray(data.videoInfos)) {
          merged.videoInfos = data.videoInfos.map((v: any) => ({
            ...v,
            videoURL: normalizeVideoURL(v.videoURL)
          }))
        }
        for (const [key, value] of Object.entries(data)) {
          if (
            key === "videoInfos" ||
            key === "vn_snapshots" ||
            key.startsWith("vn_img_")
          ) {
            merged[key] = value
            continue
          }
          try {
            new URL(key)
            const normalized = normalizeVideoURL(key)
            if (merged[normalized]) {
              const existing = merged[normalized]
              const mergedSlices = [...existing]
              for (const slice of value as any[]) {
                if (!existing.some((s: any) => s.id === slice.id)) {
                  mergedSlices.push(slice)
                }
              }
              merged[normalized] = mergedSlices
            } else {
              merged[normalized] = value
            }
          } catch {
            merged[key] = value
          }
        }
        const entries = Object.entries(merged)
        console.log("[SyncSettings] restore: writing", entries.length, "keys")
        await chrome.storage.local.clear()
        for (const [key, value] of entries) {
          await chrome.storage.local.set({ [key]: value })
        }
        const now = new Date().toISOString()
        localStorage.setItem("vn_last_sync", now)
        setLastSync(now)
        setSyncStatus("connected")
        setProgress("")
        const videoInfos = parsed.data?.videoInfos || parsed.videoInfos || []
        const videoList = Array.isArray(videoInfos)
          ? videoInfos.map((v: any) => ({
              title: v.tabTitle || v.videoURL,
              url: v.videoURL
            }))
          : []
        setMessage(
          `Restored ${entries.length} items, ${videoList.length} videos`
        )
        setTimeout(() => {
          setOpen(false)
          if (videoList.length > 0) {
            onRestore?.(videoList)
          } else {
            onRefresh?.()
          }
        }, 800)
      } else {
        setSyncStatus("error")
        setProgress("")
        setMessage(res?.error || "No backup found in Google Drive")
      }
    } catch {
      setSyncStatus("error")
      setProgress("")
      setMessage("Restore failed")
    }
  }

  const handleDisconnect = async () => {
    await sendToBackground({
      name: "drive-sync",
      body: { action: "signout" }
    })
    localStorage.removeItem("vn_last_sync")
    setLastSync(null)
    setEmail(null)
    setSyncStatus("disconnected")
    setMessage("Disconnected from Google Drive")
  }

  const toggleAutoSync = () => {
    const next = !autoSync
    setAutoSync(next)
    localStorage.setItem("vn_auto_sync", String(next))
  }

  const iconColor = {
    disconnected: "text-gray-400",
    connected: "text-green-500",
    syncing: "text-amber-500",
    error: "text-red-500"
  }[syncStatus]

  const statusColor = {
    disconnected: "bg-gray-300",
    connected: "bg-green-500",
    syncing: "bg-amber-500 animate-pulse",
    error: "bg-red-500"
  }[syncStatus]

  const formatTime = (iso: string | null) => {
    if (!iso) return "Never"
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(iso).toLocaleDateString()
  }

  return (
    <div className="relative">
      <button
        className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${iconColor}`}
        onClick={() => setOpen(!open)}
        data-tooltip={
          syncStatus === "connected"
            ? `Synced ${formatTime(lastSync)}`
            : "Drive Sync"
        }>
        <svg
          className={`w-4 h-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`}
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold dark:text-white">
              Google Drive
            </h3>
            <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
          </div>

          {syncStatus === "disconnected" && (
            <div>
              <p className="text-[11px] text-gray-400 mb-3">
                Back up your data to Google Drive. Access from any device.
              </p>
              <button
                className="w-full py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                onClick={handleConnect}>
                Connect to Google Drive
              </button>
            </div>
          )}

          {syncStatus !== "disconnected" && (
            <div className="space-y-2">
              {email && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {email}
                </p>
              )}

              {progress && (
                <div className="py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] text-blue-500">
                      {progress}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                    <div className="bg-blue-500 h-1 rounded-full animate-pulse w-2/3" />
                  </div>
                </div>
              )}

              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Last sync: {formatTime(lastSync)}
              </div>

              <div className="flex gap-1">
                <button
                  className="flex-1 py-1.5 text-[11px] border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  onClick={handleSync}
                  disabled={syncStatus === "syncing"}>
                  Sync Now
                </button>
                <button
                  className="flex-1 py-1.5 text-[11px] border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={handleRestore}>
                  Restore
                </button>
              </div>

              <label className="flex items-center justify-between py-1 text-[11px] text-gray-500 dark:text-gray-400 cursor-pointer">
                <span>Auto-sync on changes</span>
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={toggleAutoSync}
                />
              </label>

              <button
                className="w-full py-1.5 text-[11px] text-red-400 hover:text-red-500 rounded-md transition-colors"
                onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          )}

          {message && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
