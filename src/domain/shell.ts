/* 桌面版（Electron）用 app:// 协议端出页面，数据写在这台电脑的应用存储里；
   网页版才落在浏览器的 localStorage。同一套界面，文案得跟形态对上，
   不然桌面版里冒出「浏览器」会让人以为还开着个网页。 */
export const IS_DESKTOP =
  (typeof window !== 'undefined' && window.location.protocol === 'app:') ||
  import.meta.env.VITE_DESKTOP === '1'

/* 「数据存在哪儿」的三种说法 */
export const DATA_PLACE = IS_DESKTOP ? '这台电脑上' : '这台电脑的浏览器里'
export const DATA_STORE = IS_DESKTOP ? '应用本地存储' : '浏览器的本地存储'
export const DATA_RESET = IS_DESKTOP ? '清理应用数据' : '清浏览器数据'
