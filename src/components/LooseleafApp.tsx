import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Refresh, Upload, Setting, Check } from '@icon-park/react'
import type { Route } from '../App'
import { useApp } from '../domain/store'
import { useMotionPref } from '../domain/motion'
import { buildSession, newId } from '../domain/session'
import { collectWrongBook, computeDashboard, dayLabel, formatDuration, formatPercent } from '../domain/stats'
import type { SessionMode } from '../domain/types'
import { InkProvider } from '../vendor/looseleaf/ink/react'
import { Paper } from '../vendor/looseleaf/ui/paper'
import { Button } from '../vendor/looseleaf/ui/button'
import { Badge } from '../vendor/looseleaf/ui/badge'
import { Progress } from '../vendor/looseleaf/ui/progress'
import { Separator } from '../vendor/looseleaf/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../vendor/looseleaf/ui/tabs'
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from '../vendor/looseleaf/ui/select'
import { Practice } from './Practice'
import { Banks } from './Banks'
import { WrongBook } from './WrongBook'
import { Settings } from './Settings'
import { MathText } from './MathText'

const routes: { value: Route; label: string }[] = [
  { value: 'dashboard', label: '学习桌' }, { value: 'practice', label: '练习' },
  { value: 'banks', label: '题库' }, { value: 'wrong', label: '错题本' },
]

export function LooseleafApp({ route, onNavigate }: { route: Route; onNavigate: (route: Route) => void }) {
  const { workspace, activeBank, setActiveBank, session } = useApp()
  const [motion] = useMotionPref()
  return (
    <InkProvider tier="lo" motion={motion === 'reduced' ? 'reduced' : 'system'}>
      <Tabs value={route} onValueChange={value => onNavigate(value as Route)} className="ll-app">
        <header className="study-header">
          <button className="study-brand" type="button" onClick={() => onNavigate('dashboard')} aria-label="ALL RIGHT 全对，返回学习桌">
            <span>ALL RIGHT</span><small>全对</small>
          </button>
          <nav aria-label="主导航" className="study-nav">
            <TabsList>
              {routes.map(item => <TabsTrigger key={item.value} value={item.value} className="study-nav__item">{item.label}</TabsTrigger>)}
              <TabsTrigger value="settings" className="study-nav__item study-nav__settings"><Setting size={16} /><span>设置</span></TabsTrigger>
            </TabsList>
          </nav>
          <div className="study-bank">
            {workspace.banks.length ? <Select value={activeBank?.id} onValueChange={id => { if (id !== activeBank?.id) setActiveBank(id) }} disabled={!!session}>
              <SelectTrigger aria-label="当前题库" className="study-bank__select"><BookOpen size={17} /><SelectValue placeholder="选择题库" /></SelectTrigger>
              <SelectContent position="popper" align="end" tilt={false}>
                {workspace.banks.map(bank => <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>)}
              </SelectContent>
            </Select> : <Button variant="outline" size="sm" onClick={() => onNavigate('banks')}><Upload size={15} />导入题库</Button>}
          </div>
        </header>
        <TabsContent value={route} className={`ll-stage ll-route-${route}`}>
          {route === 'dashboard' ? <StudyDesk onNavigate={onNavigate} />
            : route === 'practice' ? <Practice onNavigate={onNavigate} />
              : <Paper stock="paper" edge={{ bottom: 'deckle' }} tilt={false} className="study-workspace">
                {route === 'banks' ? <Banks onNavigate={onNavigate} /> : route === 'wrong' ? <WrongBook onNavigate={onNavigate} /> : <Settings onNavigate={onNavigate} />}
              </Paper>}
        </TabsContent>
        <footer className="study-footer"><span>ALL RIGHT 全对</span><span>题库与练习记录保存在本机</span></footer>
      </Tabs>
    </InkProvider>
  )
}

export function StudyDesk({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { activeBank, workspace, startSession } = useApp()
  const data = useMemo(() => computeDashboard(activeBank, workspace), [activeBank, workspace])
  const wrong = useMemo(() => activeBank ? collectWrongBook(activeBank, workspace) : [], [activeBank, workspace])
  const [count, setCount] = useState('20')
  const begin = (mode: SessionMode, category: string | null = null) => {
    if (!activeBank) return
    const pool = mode === 'wrong' ? wrong.map(entry => entry.question) : mode === 'category' ? activeBank.questions.filter(question => question.category === category) : activeBank.questions
    const size = count === '0' ? pool.length : Number(count)
    const session = buildSession(activeBank, { mode, category, count: size }, pool, newId('s'))
    if (!session.questionIds.length) return
    startSession(session)
    onNavigate('practice')
  }
  if (!activeBank) return <Paper stock="paper" edge={{ bottom: 'deckle' }} tilt={false} className="study-welcome">
    <BookOpen size={36} />
    <h1>把题库放上学习桌</h1><p>导入 JSON 题库，开始练习。错题、用时与学习进度会留在这里。</p>
    <Button variant="secondary" size="lg" onClick={() => onNavigate('banks')}><Upload size={18} />导入题库</Button>
  </Paper>
  const max = Math.max(1, ...data.daily.map(day => day.answered))
  return (
    <div className="study-desk">
      <Paper stock="paper" edge={{ bottom: 'deckle' }} tilt={false} className="study-main-sheet">
        <div className="study-title"><div><h1>{activeBank.name}</h1><p>{data.categories.length} 个章节 · {data.totalQuestions} 道题</p></div><Badge variant="outline" tone="sky">学习进度</Badge></div>
        <div className="study-readings">
          <div><strong>{data.attemptedQuestions}<small> / {data.totalQuestions}</small></strong><span>已练题数</span></div>
          <div><strong>{formatPercent(data.overallAccuracy)}</strong><span>总正确率</span></div>
          <div><strong>{data.todayAnswered}<small> 题</small></strong><span>今天练习</span></div>
        </div>
        <Progress value={data.attemptedQuestions} max={data.totalQuestions || 1} tone="blue" size="sm" aria-label="题库练习覆盖进度" />
        <div className="study-section-title"><h2>这次练什么</h2><div className="study-count"><span>题量</span><Select value={count} onValueChange={setCount}><SelectTrigger aria-label="本次题量"><SelectValue /></SelectTrigger><SelectContent tilt={false}>{[['10', '10 题'], ['20', '20 题'], ['50', '50 题'], ['0', '全部']].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
        <Button variant="secondary" size="lg" className="study-random" onClick={() => begin('random')}>开始随机练习<ArrowRight size={18} /></Button>
        <div className="study-section-title study-chapters-heading"><h2>按章节练习</h2><span>{data.unseenQuestions} 题还未练过</span></div>
        <div className="study-chapters">
          {data.categories.map(category => <div className="study-chapter" key={category.name}>
            <div><h3>{category.name}</h3><p>共 {category.total} 题 · 已练 {category.attempted} 题</p></div>
            <div className="study-chapter__progress"><Progress value={category.attempted} max={category.total} size="sm" tone="blue" aria-label={`${category.name}进度`} /></div>
            <Button variant="outline" size="sm" onClick={() => begin('category', category.name)} aria-label={`练习${category.name}`}>练习<ArrowRight size={15} /></Button>
          </div>)}
        </div>
      </Paper>
      <aside className="study-side">
        <Paper stock="sticky-yellow" tilt={-0.6} rules="none" className="study-review-note">
          <h2>错题，再来一次</h2><p className="study-review-count"><strong>{wrong.length}</strong> 道题待复习</p>
          <Separator />
          {wrong.length ? <ul>{wrong.slice(0, 3).map(entry => <li key={entry.question.id}><MathText text={entry.question.stem} /><small>{entry.question.category} · 错 {entry.stat.wrongCount} 次</small></li>)}</ul> : <p className="study-note-empty"><Check size={21} />暂时没有错题<br /><small>答错的题会自动收进来。</small></p>}
          <Button variant="outline" className="study-review-button" disabled={!wrong.length} onClick={() => begin('wrong')}><Refresh size={16} />重练错题</Button>
          <Button variant="link" size="sm" onClick={() => onNavigate('wrong')}>打开错题本<ArrowRight size={14} /></Button>
        </Paper>
        <div className="study-side-facts"><span>连续练习<strong>{data.streak} 天</strong></span><span>累计答题用时<strong>{formatDuration(data.bankAttempts.reduce((sum, attempt) => sum + attempt.elapsedMs, 0))}</strong></span></div>
      </aside>
      <Paper stock="graph" rules="none" tilt={false} className="study-trend-sheet">
        <div className="study-section-title"><h2>最近 14 天</h2><span>每日作答量 · 蓝色答对，红色答错</span></div>
        <div className="study-chart" role="img" aria-label={`近十四天共作答 ${data.daily.reduce((sum, day) => sum + day.answered, 0)} 次`}>
          {data.daily.map(day => <div className="study-chart__day" key={day.date}><div className="study-chart__column" title={`${dayLabel(day.date)}：${day.answered} 题，答对 ${day.correct} 题`}><span style={{ height: `${((day.answered - day.correct) / max) * 100}%` }} /><i style={{ height: `${(day.correct / max) * 100}%` }} /></div><small>{dayLabel(day.date)}</small></div>)}
        </div>
        <div className="study-mastery"><span>已掌握 {data.masteredQuestions} 题</span><span>总计 {data.totalAttempts} 次作答</span><Button variant="link" size="sm" onClick={() => onNavigate('practice')}>继续练习<ArrowRight size={14} /></Button></div>
      </Paper>
    </div>
  )
}
