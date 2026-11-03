import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import './styles/looseleaf.generated.css'
import './styles/themes.css'
import { AppProvider } from './domain/store'
import { App } from './App'
import { applyMotion, loadMotion } from './domain/motion'
import { loadWorkspace } from './domain/storage'
import { applyTheme, loadTheme } from './domain/theme'

applyMotion(loadMotion())
applyTheme(loadTheme())

const root = createRoot(document.getElementById('root')!)

async function start() {
  const initialWorkspace = await loadWorkspace()
  root.render(
    <StrictMode>
      <AppProvider initialWorkspace={initialWorkspace}>
        <App />
      </AppProvider>
    </StrictMode>,
  )
}

void start().catch((error: unknown) => {
  root.render(
    <div className="empty" role="alert">
      <p className="empty__title">读取本地数据失败</p>
      <p className="empty__text">{String(error)}</p>
      <p className="empty__text">请保留数据文件，重试或从备份恢复。</p>
      <button type="button" className="btn" onClick={() => window.location.reload()}>重试</button>
    </div>,
  )
})
