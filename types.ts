export type VideoInfo = {
  url: string
  duration: number
}

export type VideoSlice = {
  startTime: number
  endTime: number
  startTimeInput: string
  endTimeInput: string
  isPlaying: boolean
}

export type VideoResult = {
  tabId: number
  tabTitle: string
  videoURL: string
  video: VideoInfo
}
