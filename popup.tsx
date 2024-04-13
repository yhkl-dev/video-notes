import "./style.css"

export default function IndexPopup() {
  return (
    <div className="w-[300px] flex flex-col items-center justify-center p-4">
      <p className="text-gray-600 mb-2 text-sm">
        {chrome.i18n.getMessage("popupHint")}
      </p>
    </div>
  )
}
