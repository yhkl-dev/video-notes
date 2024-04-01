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
