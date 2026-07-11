import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = {
  tabId: number
}

export type ResponseBody = {
  chapters: Array<{ startTime: number; title: string }>
}

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: req.body.tabId },
      func: () => {
        const chapters: Array<{ startTime: number; title: string }> = []

        const markers = document.querySelectorAll(
          "ytd-macro-markers-list-item-renderer"
        )
        if (markers.length > 0) {
          markers.forEach((el) => {
            const timeEl = el.querySelector("#time")
            const titleEl = el.querySelector("#title")
            if (timeEl && titleEl) {
              const parts = timeEl.textContent?.trim().split(":") || []
              let seconds = 0
              if (parts.length === 2) {
                seconds = Number(parts[0]) * 60 + Number(parts[1])
              } else if (parts.length === 3) {
                seconds =
                  Number(parts[0]) * 3600 +
                  Number(parts[1]) * 60 +
                  Number(parts[2])
              }
              const title = titleEl.textContent?.trim() || ""
              if (seconds > 0 && title) {
                chapters.push({ startTime: seconds, title })
              }
            }
          })
          return chapters
        }

        const descLinks = document.querySelectorAll(
          "#description-inline-expander a[href*='&t=']"
        )
        descLinks.forEach((el) => {
          const href = el.getAttribute("href") || ""
          const match = href.match(/[?&]t=(\d+)/)
          const title = el.textContent?.trim() || ""
          if (match && title) {
            chapters.push({
              startTime: Number(match[1]),
              title
            })
          }
        })

        return chapters
      }
    })

    res.send({ chapters: result?.result || [] })
  } catch {
    res.send({ chapters: [] })
  }
}

export default handler
