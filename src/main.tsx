import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import { AppProvider } from './domain/store'
import { App } from './App'
import { applyMotion, loadMotion } from './domain/motion'

applyMotion(loadMotion())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
