import { useMemo, useState, useEffect, useRef } from 'react'
import {
  Bookmark as BookMarked,
  ChartHistogram as ChartNoAxesColumn,
  Book as Library,
  Edit as PenLine,
  Setting as SettingsIcon,
} from '@icon-park/react'
import { useApp } from './domain/store'
import { computeDashboard } from './domain/stats'
import { IS_DESKTOP } from './domain/shell'
import { Dashboard } from './components/Dashboard'
import { Practice } from './components/Practice'
import { Banks } from './components/Banks'
import { WrongBook } from './components/WrongBook'
import { Settings } from './components/Settings'
import { useTheme } from './domain/theme'
import { LooseleafApp } from './components/LooseleafApp'
import { AppUpdate } from './components/AppUpdate'

export type Route = 'dashboard' | 'practice' | 'banks' | 'wrong' | 'settings'

const NAV: { route: Route; label: string; icon: typeof ChartNoAxesColumn }[] = [
  { route: 'dashboard', label: '看板', icon: ChartNoAxesColumn },
  { route: 'practice', label: '练习', icon: PenLine },
  { route: 'banks', label: '题库', icon: Library },
  { route: 'wrong', label: '错题本', icon: BookMarked },
  { route: 'settings', label: '设置', icon: SettingsIcon },
]

export function App() {
  const { workspace, activeBank, session, clockSession } = useApp()
  const [route, setRoute] = useState<Route>(() => session ? 'practice' : 'dashboard')
  const [theme] = useTheme()
  const previousRoute = useRef(route)
  useEffect(() => {
    if (previousRoute.current === 'practice' && route !== 'practice') clockSession(true)
    previousRoute.current = route
  }, [route, clockSession])

  const dashboard = useMemo(
    () => computeDashboard(activeBank, workspace),
    [activeBank, workspace],
  )

  const wrongCount = dashboard.wrongBookCount

  if (theme === 'looseleaf') return <LooseleafApp route={route} onNavigate={setRoute} />

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail__brand">
          <span className="rail__name">ALL RIGHT</span>
          <span className="rail__tag">全对</span>
        </div>

        <nav className="rail__nav" aria-label="主导航">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = route === item.route
            return (
              <button
                key={item.route}
                type="button"
                className={active ? 'rail__item rail__item--active' : 'rail__item'}
                aria-current={active ? 'page' : undefined}
                onClick={() => setRoute(item.route)}
              >
                <span className="rail__dot" aria-hidden="true" />
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{item.label}</span>
                {item.route === 'wrong' && wrongCount > 0 ? (
                  <span className="rail__count">{wrongCount}</span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="rail__foot">
          <p className="rail__foot-label">当前题库</p>
          <p className="rail__bank">{activeBank ? activeBank.name : '尚未导入'}</p>
          <p className="rail__bank-meta">
            {activeBank
              ? `${activeBank.questions.length} 题 · ${new Set(activeBank.questions.map((q) => q.category)).size} 个分类`
              : `数据保存在本机${IS_DESKTOP ? '应用' : '浏览器'}`}
          </p>
          <AppUpdate />
        </div>
      </aside>

      <div className="main">
        {route === 'dashboard' ? (
          <Dashboard onNavigate={setRoute} />
        ) : route === 'practice' ? (
          <Practice onNavigate={setRoute} />
        ) : route === 'banks' ? (
          <Banks onNavigate={setRoute} />
        ) : route === 'settings' ? (
          <Settings onNavigate={setRoute} />
        ) : (
          <WrongBook onNavigate={setRoute} />
        )}
      </div>
    </div>
  )
}
