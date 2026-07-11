export default function CoverageBar({ percent }: { percent: number }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{chrome.i18n.getMessage("coverageStats")}</span>
        <span>
          {chrome.i18n
            .getMessage("coverage")
            .replace("{percent}", String(percent))}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  )
}
