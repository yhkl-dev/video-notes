import "./style.css"

export default function IndexPopup() {
  const openSidebar = () => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  }
  return <></>

  // return (
  //   <div className="w-[300px] flex flex-col items-center justify-center p-4">
  //     <p className="text-gray-600 mb-2 text-sm">
  //       {chrome.i18n.getMessage("popupHint")}
  //     </p>
  //     <button onClick={openSidebar}>Open Sidebar</button>
  //   </div>
  // )
}
