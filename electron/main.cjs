/**
 * ALL RIGHT 全对 —— 桌面壳（Electron 主进程）
 *
 * 界面本体是构建出来的静态页面，这个进程只做四件事：
 *   1. 开一个隔离干净的窗口（渲染进程拿不到 Node，也拿不到文件系统）
 *   2. 用 app:// 协议把 dist/ 端出去——这样页面有一个真正的源，
 *      localStorage 稳定落盘，fetch 也取得到示例题库
 *      （file:// 下 fetch 会被浏览器按 CORS 拦掉）
 *   3. 记住窗口的大小与位置
 *   4. 给一套中文菜单，不留 Electron 默认那套英文的
 */
const { app, BrowserWindow, Menu, dialog, protocol, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const SCHEME = 'app'
const ORIGIN = `${SCHEME}://bundle`
const DIST = path.join(__dirname, '..', 'dist')
const DEV_URL = process.env.VITE_DEV_SERVER_URL || ''
const isDev = Boolean(DEV_URL)

/* 便携版与自动化测试用：把数据目录指到别处。
   得在 app ready 之前设好，setPath 对 userData 才生效。 */
if (process.env.ALLRIGHT_USER_DATA) {
  app.setPath('userData', process.env.ALLRIGHT_USER_DATA)
} else if (process.env.PORTABLE_EXECUTABLE_DIR) {
  /* 便携版：数据跟着 exe 走，整个文件夹拷到 U 盘也能接着用 */
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data'))
}

/* app:// 必须先声明特权，才拿得到真正的源、稳定的 localStorage 和 fetch 支持 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
}

let mainWindow = null

/* ---------------- 窗口状态 ---------------- */

function stateFile() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
    if (typeof s.width === 'number' && typeof s.height === 'number') return s
  } catch {
    /* 第一次启动没有这个文件，用默认值 */
  }
  return null
}

function saveState(win) {
  if (!win || win.isDestroyed() || win.isMinimized()) return
  try {
    const b = win.getNormalBounds()
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }))
  } catch {
    /* 写不进去也不能影响使用 */
  }
}

/* ---------------- app:// 协议 ---------------- */

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    let pathname
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname)
    } catch {
      return new Response('bad request', { status: 400 })
    }
    if (pathname === '/' || pathname === '') pathname = '/index.html'
    /* 只允许读 dist/ 里的东西，别让路径穿越出去 */
    const filePath = path.normalize(path.join(DIST, pathname))
    if (filePath !== DIST && !filePath.startsWith(DIST + path.sep)) {
      return new Response('forbidden', { status: 403 })
    }
    try {
      const body = await fs.promises.readFile(filePath)
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      return new Response(body, { headers: { 'Content-Type': type } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}

/* ---------------- 窗口 ---------------- */

function createWindow() {
  const state = readState()
  mainWindow = new BrowserWindow({
    width: state?.width ?? 1440,
    height: state?.height ?? 900,
    x: state?.x,
    y: state?.y,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#e2e5e6', // 纸面冷灰，避免加载瞬间闪白
    title: 'ALL RIGHT 全对',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
    },
  })

  if (state?.maximized) mainWindow.maximize()
  mainWindow.once('ready-to-show', () => mainWindow.show())

  /* 站外链接交给系统浏览器，不在应用里开新窗 */
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  /* 别让页面把窗口导航到别处 */
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith(DEV_URL) : url.startsWith(ORIGIN)
    if (!allowed) {
      event.preventDefault()
      if (/^https?:\/\//.test(url)) shell.openExternal(url)
    }
  })

  const save = () => saveState(mainWindow)
  mainWindow.on('resize', save)
  mainWindow.on('move', save)
  mainWindow.on('close', save)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
  } else {
    mainWindow.loadURL(`${ORIGIN}/index.html`)
  }
}

/* ---------------- 菜单 ---------------- */

function showAbout() {
  dialog.showMessageBox({
    type: 'info',
    title: '关于 ALL RIGHT 全对',
    message: 'ALL RIGHT 全对',
    detail:
      '电子刷题台。导入 JSON 题库，按分类或随机抽题，答错的题自动收进错题本。\n\n' +
      `题库与练习记录都存在这台电脑本地（${app.getPath('userData')}），不上传、不同步。\n\n` +
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
    buttons: ['好'],
  })
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开数据文件夹',
          click: () => shell.openPath(app.getPath('userData')),
        },
        { type: 'separator' },
        { label: '退出', role: 'quit', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
        { label: '开发者工具', role: 'toggleDevTools' },
      ],
    },
    {
      label: '帮助',
      submenu: [{ label: '关于 ALL RIGHT 全对', click: showAbout }],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/* ---------------- 生命周期 ---------------- */

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.allright.quandui')
    registerAppProtocol()
    buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
