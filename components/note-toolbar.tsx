import type { ChangeEvent } from "react"

interface Template {
  key: string
  label: string
}

export default function NoteToolbar({
  sliceId,
  templates,
  onAppend,
  onInsertImage,
  onCaptureFrame,
  onInsertTemplate
}: {
  sliceId: string
  templates: Template[]
  onAppend: (id: string, text: string) => void
  onInsertImage: (id: string) => void
  onCaptureFrame: (id: string) => void
  onInsertTemplate: (event: ChangeEvent<HTMLSelectElement>, id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs mt-2">
      <span className="text-gray-500 dark:text-gray-400">
        {chrome.i18n.getMessage("noteToolbar")}
      </span>
      <button
        type="button"
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
        onClick={() => onAppend(sliceId, "**bold text**")}>
        {chrome.i18n.getMessage("boldLabel")}
      </button>
      <button
        type="button"
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
        onClick={() => onAppend(sliceId, "*italic text*")}>
        {chrome.i18n.getMessage("italicLabel")}
      </button>
      <button
        type="button"
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
        onClick={() => onAppend(sliceId, "```\ncode block\n```")}>
        {chrome.i18n.getMessage("codeLabel")}
      </button>
      <button
        type="button"
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
        onClick={() => onInsertImage(sliceId)}>
        {chrome.i18n.getMessage("insertImage")}
      </button>
      <button
        type="button"
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 rounded-md hover:bg-gray-200"
        onClick={() => onCaptureFrame(sliceId)}>
        {chrome.i18n.getMessage("captureFrame")}
      </button>
      <select
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-md focus:outline-none"
        defaultValue=""
        onChange={(event) => onInsertTemplate(event, sliceId)}>
        <option value="" disabled>
          {chrome.i18n.getMessage("templateLabel")}
        </option>
        {templates.map((template) => (
          <option key={template.key} value={template.key}>
            {template.label}
          </option>
        ))}
      </select>
    </div>
  )
}
