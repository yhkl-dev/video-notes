# Chrome Extension Feature Documentation

This Chrome extension is designed to offer a streamlined interface for users to segment and manage video playback times. With this extension, users can specify particular segments of a video and perform actions such as play, pause, reset, or delete on these segments.

## Key Features

- **Video Information Display**: The extension displays the current video's URL and duration, providing users with quick insights into the basic information of the video.

- **Segment Management**:

  - **Add Segments**: Users can add a new video segment by setting a start and end time. The extension will alert the user if the start time is greater than the end time or if the end time exceeds the video's total duration.
  - **Play/Pause**: For each segment, users can control the video's playback state by clicking the play or pause button.
  - **Reset Segments**: Users have the option to reset a segment to its initial state.
  - **Delete Segments**: Allows users to remove segments from the list that are no longer needed.

- **Time Selector**: Hour, minute, and second dropdown selectors are provided for users to accurately set the start and end times of segments.

- **Video Control**: Through communication with a background script, the extension can control video playback, pause, and reset actions.

- **Automatic Video Information Refresh**: The extension automatically refreshes video information upon launch to ensure users see the most current state of the video.

## How to Use

1. After installing the extension, open a webpage containing a video.
2. Click on the extension icon in the browser toolbar to open the extension's popup window.
3. If the video information has loaded, you can start adding segments or manage existing ones.
4. Use the dropdown selectors to set the start and end times of a segment, then click the "Add Segment" button.
5. For each segment, you can use the play, pause, reset, or delete buttons to perform the corresponding actions.

## Notes

- Ensure that your video page is fully loaded so that the extension can correctly detect and fetch video information.
- If you switch videos or video pages, you may need to click the refresh button in the extension to update the video information.

This extension is designed to enhance the efficiency of video viewing and management, hoping to help you better control and enjoy your video content.
