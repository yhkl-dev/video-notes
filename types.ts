export type VideoInfo = {
  url: string
  duration: number
}

export type VideoSlice = {
  id: string
  createdAt: number
  startTime: number
  endTime: number
  startTimeInput: string
  endTimeInput: string
  isPlaying: boolean
  note: string
  editing: boolean
  tags: string[]
}

export type VideoResult = {
  tabId: number
  tabTitle: string
  videoURL: string
  video: VideoInfo | null
}
