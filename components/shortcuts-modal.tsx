export default function ShortcutsModal({
  show,
  onClose
}: {
  show: boolean
  onClose: () => void
}) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold dark:text-white">
            {chrome.i18n.getMessage("shortcutsTitle")}
          </h3>
          <button
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={onClose}>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex justify-between">
            <span>{chrome.i18n.getMessage("shortcutsSpace")}</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              Space
            </kbd>
          </div>
          <div className="flex justify-between">
            <span>{chrome.i18n.getMessage("shortcutsSeek")}</span>
            <span>
              <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                ←
              </kbd>{" "}
              <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                →
              </kbd>
            </span>
          </div>
          <div className="flex justify-between">
            <span>{chrome.i18n.getMessage("shortcutsUndo")}</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              Ctrl+Z
            </kbd>
          </div>
          <div className="flex justify-between">
            <span>{chrome.i18n.getMessage("shortcutsRedo")}</span>
            <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              Ctrl+Shift+Z
            </kbd>
          </div>
        </div>
        <button
          className="mt-4 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm"
          onClick={onClose}>
          {chrome.i18n.getMessage("shortcutsClose")}
        </button>
      </div>
    </div>
  )
}
