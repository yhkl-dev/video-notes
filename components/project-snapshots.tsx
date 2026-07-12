import { useEffect, useState } from "react"

import type { VideoSlice } from "~types"

export interface ProjectSnapshot {
  id: string
  name: string
  createdAt: number
  videoURL: string
  videoTitle: string
  slices: VideoSlice[]
}

const STORAGE_KEY = "vn_snapshots"

export async function loadSnapshots(): Promise<ProjectSnapshot[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  return Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : []
}

export async function saveSnapshot(
  name: string,
  videoURL: string,
  videoTitle: string,
  slices: VideoSlice[]
) {
  const existing = await loadSnapshots()
  const snapshot: ProjectSnapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    createdAt: Date.now(),
    videoURL,
    videoTitle,
    slices: slices.map((s) => ({ ...s, isPlaying: false, editing: false }))
  }
  const updated = [...existing, snapshot]
  await chrome.storage.local.set({ [STORAGE_KEY]: updated })
  return snapshot
}

export async function deleteSnapshot(id: string) {
  const existing = await loadSnapshots()
  await chrome.storage.local.set({
    [STORAGE_KEY]: existing.filter((s) => s.id !== id)
  })
}

export default function ProjectSnapshots({
  currentVideoURL,
  videoSlices,
  currentVideoTitle,
  onLoadSlices
}: {
  currentVideoURL: string
  videoSlices: VideoSlice[]
  currentVideoTitle: string
  onLoadSlices: (slices: VideoSlice[], videoURL: string) => void
}) {
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([])
  const [showSave, setShowSave] = useState(false)
  const [name, setName] = useState("")
  const [showList, setShowList] = useState(false)

  useEffect(() => {
    loadSnapshots().then(setSnapshots)
  }, [])

  return (
    <div className="relative">
      <div className="flex items-center gap-0.5">
        <button
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          onClick={() => setShowList(!showList)}
          data-tooltip={`Snapshots (${snapshots.length})`}>
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
          {snapshots.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
              {snapshots.length}
            </span>
          )}
        </button>
        {videoSlices.length > 0 && (
          <button
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setShowSave(!showSave)}
            data-tooltip="Save snapshot">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </button>
        )}
      </div>

      {showSave && (
        <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 z-40 w-64">
          <input
            type="text"
            className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 mb-2"
            placeholder="Snapshot name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && name.trim()) {
                await saveSnapshot(
                  name.trim(),
                  currentVideoURL,
                  currentVideoTitle,
                  videoSlices
                )
                setName("")
                setShowSave(false)
                setSnapshots(await loadSnapshots())
              }
            }}
          />
        </div>
      )}

      {showList && (
        <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-40 w-72 max-h-60 overflow-y-auto">
          {snapshots.length === 0 && (
            <p className="text-xs text-gray-400 p-2">No snapshots yet</p>
          )}
          {snapshots.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md group">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium dark:text-gray-200 truncate">
                  {s.name}
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {s.videoTitle || s.videoURL} · {s.slices.length} segments
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <button
                  className="text-xs text-blue-500 hover:text-blue-700 px-1"
                  onClick={() => {
                    onLoadSlices(s.slices, s.videoURL)
                    setShowList(false)
                  }}>
                  Load
                </button>
                <button
                  className="text-xs text-red-400 hover:text-red-600 px-1"
                  onClick={async () => {
                    await deleteSnapshot(s.id)
                    setSnapshots(await loadSnapshots())
                  }}>
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
