import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

type SyncStatus = "disconnected" | "connected" | "syncing" | "error"

export default function SyncSettings() {
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

  useEffect(() => {
    if (!open) return
    setSyncStatus("syncing")
    sendToBackground({ name: "drive-sync", body: { action: "status" } })
      .then((res: any) => {
        if (res?.email) setEmail(res.email)
        if (res?.lastModified) setLastSync(res.lastModified)
        setSyncStatus(res?.error ? "error" : "connected")
        if (res?.error) setMessage(res.error)
      })
      .catch(() => {
        setSyncStatus("error")
        setMessage("Connection failed")
      })
  }, [open])

  const handleConnect = async () => {
    setSyncStatus("syncing")
    setMessage("")
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
        setMessage("Connected and synced")
      } else {
        setSyncStatus("error")
        setMessage(res?.error || "Auth failed")
      }
    } catch {
      setSyncStatus("error")
      setMessage("Network error")
    }
  }

  const handleSync = async () => {
    setSyncStatus("syncing")
    setMessage("")
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
        setMessage("Synced")
        setTimeout(() => setMessage(""), 2000)
      } else {
        setSyncStatus("error")
        setMessage(res?.error || "Sync failed")
      }
    } catch {
      setSyncStatus("error")
      setMessage("Network error")
    }
  }

  const handleRestore = async () => {
    if (!confirm("This will replace all local data with the cloud backup. Continue?")) return
    setSyncStatus("syncing")
    setMessage("")
    try {
      const res = await sendToBackground({
        name: "drive-sync",
        body: { action: "download" }
      })
      if (res?.data) {
        const parsed = JSON.parse(res.data)
        for (const [key, value] of Object.entries(parsed)) {
          await chrome.storage.local.set({ [key]: value })
        }
        const now = new Date().toISOString()
        localStorage.setItem("vn_last_sync", now)
        setLastSync(now)
        setSyncStatus("connected")
        setMessage("Restored. Reloading...")
        setTimeout(() => window.location.reload(), 1200)
      } else {
        setSyncStatus("error")
        setMessage(res?.error || "No backup found in Drive")
      }
    } catch {
      setSyncStatus("error")
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
    setMessage("Disconnected")
  }

  const toggleAutoSync = () => {
    const next = !autoSync
    setAutoSync(next)
    localStorage.setItem("vn_auto_sync", String(next))
  }

  const iconColor = {
    disconnected: "text-gray-400",
    connected: "text-green-500",
    syncing: "text-amber-500 animate-spin",
    error: "text-red-500"
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
          syncStatus === "connected" ? `Synced ${formatTime(lastSync)}` : "Drive Sync"
        }>
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
          className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-40 w-60"
          onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold dark:text-white mb-1">
            Google Drive Sync
          </h3>

          {syncStatus === "disconnected" && (
            <div className="mt-2">
              <p className="text-[11px] text-gray-400 mb-3">
                Sync your notes across devices via Google Drive.
              </p>
              <button
                className="w-full py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                onClick={handleConnect}>
                Connect Google Drive
              </button>
            </div>
          )}

          {syncStatus !== "disconnected" && (
            <div className="mt-2 space-y-2">
              {email && (
                <p className="text-[10px] text-gray-400 truncate">{email}</p>
              )}
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>
                  {syncStatus === "syncing"
                    ? "Syncing..."
                    : `Last sync: ${formatTime(lastSync)}`}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncStatus === "connected"
                      ? "bg-green-500"
                      : syncStatus === "syncing"
                        ? "bg-amber-500 animate-pulse"
                        : "bg-red-500"
                  }`}
                />
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
                <span>Auto-sync</span>
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
            <p className="text-[10px] text-gray-400 mt-2">{message}</p>
          )}
        </div>
      )}
    </div>
  )
}
