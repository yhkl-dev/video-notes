import { Storage } from "@plasmohq/storage"

console.log(
  "Live now; make now always the most precious time. Now will never come again."
)

const storage = new Storage()

function getVideoInfo() {
  const video = document.querySelector("video")
  if (video) {
    return {
      url: video.src,
      duration: video.duration
    }
  }
  return null
}

storage.clear()
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  var currentTabId = tabs[0].id
  console.log("当前标签页的ID是：", currentTabId)
  chrome.scripting
    .executeScript({
      target: { tabId: currentTabId },
      func: getVideoInfo
    })
    .then((res) => {
      storage.set("videoInfo", res)
      storage.set("tabId", currentTabId)
    })
})
