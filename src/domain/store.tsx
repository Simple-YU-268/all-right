import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { type AssetMeta, type AttemptRecord, type Bank, type SessionMode, type SessionRecord, type Workspace } from './types'
import { saveWorkspace } from './storage'
import { confirmAction } from './shell'
import { saveChapter, deleteChapter, importChapters, type ChapterChange, type ChapterImport } from './chapters'
import { pruneAssetsExcept, referencedAssetIds } from './assets'
import { questionAssetIds } from './content'
import { buildSession, remainingChapterQuestions } from './session'
import { bankStatKeys, legacyStatOf, migrateStats, statKey } from './statKey'
import {
  commitClock,
  createClock,
  currentQuestionElapsed,
  sessionElapsed,
  setPaused,
  switchQuestion,
  tickClock,
  type SessionClock,
} from './sessionClock'

export interface ActiveSession {
  id: string
  bankId: string
  mode: SessionMode
  category: string | null
  questionIds: string[]
  index: number
  startedAt: number
  answers: Record<string, { chosen: string[]; correct: boolean; elapsedMs: number }>
  questionStartedAt: number
  paused?: boolean
  elapsedMs?: number
  clockAt?: number
  questionSignatures?: Record<string, string>
  drafts?: Record<string, string[]>
  elapsedByQuestion?: Record<string, number>
}

interface State {
  workspace: Workspace
  session: ActiveSession | null
}

function restoreSession(workspace: Workspace): ActiveSession | null {
  const value = workspace.activeSession
  if (!value || typeof value.id !== 'string' || !['random', 'category', 'wrong'].includes(value.mode) ||
    !Array.isArray(value.questionIds) || !value.questionIds.length ||
    !Number.isInteger(value.index) || value.index < 0 || value.index >= value.questionIds.length ||
    !value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers) ||
    new Set(value.questionIds).size !== value.questionIds.length) return null
  const bank = workspace.banks.find(bank => bank.id === value.bankId)
  if (!bank || value.questionIds.some(id => !bank.questions.some(question => question.id === id))) return null
  if (Object.keys(value.answers).some(id => !value.questionIds.includes(id))) return null
  if (value.questionSignatures && value.questionIds.some(id => {
    const question = bank.questions.find(question => question.id === id)!
    return value.questionSignatures?.[id] !== JSON.stringify([question.type, question.stem, question.stemBlocks, question.options, question.answer])
  })) return null
  if (Object.values(value.answers).some(answer => !answer || !Array.isArray(answer.chosen) ||
    answer.chosen.some(key => typeof key !== 'string') ||
    typeof answer.correct !== 'boolean' || !Number.isFinite(answer.elapsedMs) || answer.elapsedMs < 0)) return null
  if (value.drafts && (typeof value.drafts !== 'object' || Object.values(value.drafts).some(draft =>
    !Array.isArray(draft) || draft.some(key => typeof key !== 'string')))) return null
  if (value.elapsedByQuestion && (typeof value.elapsedByQuestion !== 'object' || Object.values(value.elapsedByQuestion).some(time =>
    !Number.isFinite(time) || time < 0))) return null
  return { ...value, paused: true, clockAt: Date.now(), questionStartedAt: Date.now(),
    elapsedMs: Number.isFinite(value.elapsedMs) ? Math.max(0, value.elapsedMs!) : 0 }
}

/** 图片清单跟着题目走：删掉一个题库，别的题库还在用的图要留下。 */
function keepAssets(workspace: Workspace, banks: Bank[]): Record<string, AssetMeta> {
  const used = new Set<string>()
  for (const bank of banks) {
    for (const question of bank.questions) {
      for (const id of questionAssetIds(question)) used.add(id)
    }
  }
  const assets: Record<string, AssetMeta> = {}
  for (const id of used) {
    const meta = workspace.assets?.[id]
    if (meta) assets[id] = meta
  }
  return assets
}

type Action =
  | { type: 'addBank'; bank: Bank; assets: Record<string, AssetMeta> }
  | { type: 'removeBank'; bankId: string }
  | { type: 'renameBank'; bankId: string; name: string }
  | { type: 'saveChapter'; change: ChapterChange }
  | { type: 'importChapters'; change: ChapterImport }
  | { type: 'deleteChapter'; bankId: string; category: string }
  | { type: 'setActiveBank'; bankId: string }
  | { type: 'recordAttempt'; attempt: AttemptRecord }
  | { type: 'removeFromWrongBook'; questionId: string; bankId: string; key: string }
  | { type: 'resetBank'; bankId: string }
  | { type: 'replaceWorkspace'; workspace: Workspace }
  | { type: 'startSession'; session: ActiveSession }
  | { type: 'updateSession'; session: ActiveSession }
  | { type: 'endSession' }
  | { type: 'setPaused'; paused: boolean }
  | { type: 'finishSession'; record: SessionRecord }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'saveChapter':
    case 'importChapters':
    case 'deleteChapter': {
      const result = action.type === 'saveChapter'
        ? saveChapter(state.workspace, action.change)
        : action.type === 'importChapters'
          ? importChapters(state.workspace, action.change)
          : deleteChapter(state.workspace, action.bankId, action.category)
      let session = state.session
      if (session?.bankId === result.bankId) {
        if (session.questionIds.some((questionId) => result.invalidatedIds.has(questionId))) session = null
        else if (session.category === result.previousCategory && result.previousCategory !== null) {
          session = { ...session, category: result.category }
        }
      }
      return {
        workspace: { ...result.workspace, assets: keepAssets(result.workspace, result.workspace.banks) },
        session,
      }
    }
    case 'addBank':
      return {
        ...state,
        workspace: {
          ...state.workspace,
          banks: [...state.workspace.banks, action.bank],
          activeBankId: action.bank.id,
          assets: { ...state.workspace.assets, ...action.assets },
        },
      }
    case 'removeBank': {
      const banks = state.workspace.banks.filter((b) => b.id !== action.bankId)
      const stats = { ...state.workspace.stats }
      for (const key of bankStatKeys(state.workspace, action.bankId)) delete stats[key]
      /* 老数据里没有题库维度的键：这个题库的题号清干净。 */
      const removedIds = new Set(
        state.workspace.banks.find((b) => b.id === action.bankId)?.questions.map((q) => q.id) ?? [],
      )
      for (const id of removedIds) delete stats[id]
      return {
        ...state,
        workspace: {
          ...state.workspace,
          banks,
          stats,
          attempts: state.workspace.attempts.filter((a) => a.bankId !== action.bankId),
          sessions: state.workspace.sessions.filter((s) => s.bankId !== action.bankId),
          assets: keepAssets(state.workspace, banks),
          activeBankId:
            state.workspace.activeBankId === action.bankId ? (banks[0]?.id ?? null) : state.workspace.activeBankId,
        },
        session: state.session?.bankId === action.bankId ? null : state.session,
      }
    }
    case 'renameBank':
      return {
        ...state,
        workspace: {
          ...state.workspace,
          banks: state.workspace.banks.map((b) => (b.id === action.bankId ? { ...b, name: action.name } : b)),
        },
      }
    case 'setActiveBank':
      return { ...state, workspace: { ...state.workspace, activeBankId: action.bankId } }
    case 'recordAttempt': {
      const { attempt } = action
      if (state.workspace.attempts.some(existing => existing.id === attempt.id)) return state
      const key = statKey(attempt.bankId, attempt.questionId)
      const prev = state.workspace.stats[key] ?? legacyStatOf(state.workspace, attempt.bankId, attempt.questionId)
      const consecutiveCorrect = attempt.correct ? (prev?.consecutiveCorrect ?? 0) + 1 : 0
      return {
        ...state,
        workspace: {
          ...state.workspace,
          attempts: [...state.workspace.attempts, attempt],
          stats: {
            ...state.workspace.stats,
            [key]: {
              questionId: attempt.questionId,
              attempts: (prev?.attempts ?? 0) + 1,
              correctCount: (prev?.correctCount ?? 0) + (attempt.correct ? 1 : 0),
              wrongCount: (prev?.wrongCount ?? 0) + (attempt.correct ? 0 : 1),
              consecutiveCorrect,
              lastAt: attempt.at,
              totalMs: (prev?.totalMs ?? 0) + attempt.elapsedMs,
            },
          },
        },
      }
    }
    case 'removeFromWrongBook': {
      const prev = state.workspace.stats[action.key] ?? legacyStatOf(state.workspace, action.bankId, action.questionId)
      if (!prev) return state
      return {
        ...state,
        workspace: {
          ...state.workspace,
          stats: {
            ...state.workspace.stats,
            [action.key]: {
              ...prev,
              consecutiveCorrect: Math.max(1, prev.consecutiveCorrect),
            },
          },
        },
      }
    }
    case 'resetBank': {
      const stats = { ...state.workspace.stats }
      for (const key of bankStatKeys(state.workspace, action.bankId)) delete stats[key]
      const resetIds = new Set(
        state.workspace.banks.find((b) => b.id === action.bankId)?.questions.map((q) => q.id) ?? [],
      )
      for (const id of resetIds) delete stats[id]
      return {
        ...state,
        workspace: {
          ...state.workspace,
          stats,
          attempts: state.workspace.attempts.filter((a) => a.bankId !== action.bankId),
        },
        session: state.session?.bankId === action.bankId ? null : state.session,
      }
    }
    case 'replaceWorkspace':
      return { ...state, workspace: action.workspace, session: restoreSession(action.workspace) }
    case 'startSession':
      return { ...state, session: action.session, workspace: { ...state.workspace, activeBankId: action.session.bankId } }
    case 'updateSession':
      return { ...state, session: action.session }
    case 'endSession':
      return { ...state, session: null }
    case 'setPaused':
      /* 暂停要落盘：关掉软件再打开时不该把看不见的时间算成答题时间。 */
      if (!state.session) return state
      if (!!state.session.paused === action.paused) return state
      return { ...state, session: { ...state.session, paused: action.paused } }
    case 'finishSession':
      /* 练习历史：每次结算留一条，题库被删时一起清掉。 */
      return {
        ...state,
        session: state.session?.id === action.record.id ? null : state.session,
        workspace: {
          ...state.workspace,
          sessions: [action.record, ...state.workspace.sessions.filter(record => record.id !== action.record.id)].slice(0, 200),
        },
      }
    default:
      return state
  }
}

export interface AppApi {
  workspace: Workspace
  session: ActiveSession | null
  activeBank: Bank | null
  addBank: (bank: Bank, assets?: Record<string, AssetMeta>) => void
  removeBank: (bankId: string) => void
  renameBank: (bankId: string, name: string) => void
  saveChapter: (change: ChapterChange) => void
  importChapters: (change: ChapterImport) => void
  deleteChapter: (bankId: string, category: string) => void
  setActiveBank: (bankId: string) => void
  recordAttempt: (attempt: AttemptRecord) => void
  removeFromWrongBook: (questionId: string, bankId: string) => void
  resetBank: (bankId: string) => void
  replaceWorkspace: (workspace: Workspace) => void
  /**
   * 开一组新练习前确认替换，取消时保留原进度和草稿。
   */
  startSessionReplacing: (session: ActiveSession, fromStart?: boolean) => void
  updateSession: (session: ActiveSession) => void
  endSession: () => void
  /** 结算并记一条练习历史。 */
  finishSession: (record: SessionRecord) => void
  clockSession: (paused?: boolean) => void
  /** 本次练习累计毫秒（走表中的实时值）。 */
  sessionElapsed: () => number
  /** 某道题已经走了多久。 */
  questionElapsed: (questionId: string, answeredMs?: number) => number
  snapshotWorkspace: () => Workspace
}

const AppContext = createContext<AppApi | null>(null)

export function AppProvider({ children, initialWorkspace }: { children: ReactNode; initialWorkspace: Workspace }) {
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    /* 老工作区的统计键里没有题库，先迁移到新格式。 */
    const workspace = migrateStats(initialWorkspace)
    return { workspace, session: restoreSession(workspace) }
  })
  /* 秒表独立于工作区状态：它每秒动一次，但不该每秒触发一次整份写盘。 */
  const clockRef = useRef<SessionClock | null>(null)
  const sessionRef = useRef<ActiveSession | null>(state.session)
  sessionRef.current = state.session
  if (state.session && !clockRef.current) clockRef.current = createClock(state.session)
  if (!state.session) clockRef.current = null

  useEffect(() => {
    let active = true
    const clock = clockRef.current
    const session = state.session && clock ? commitClock(clock, state.session) : state.session
    void saveWorkspace({ ...state.workspace, activeSession: session }).then(
      () => { if (active) setStorageError(null) },
      (error: unknown) => { if (active) setStorageError(`保存失败，请先导出备份：${String(error)}`) },
    )
    return () => { active = false }
  }, [state.workspace, state.session])

  useEffect(() => {
    /* 关掉页面前把秒表停住，别把看不见的时间算成答题时间。 */
    const pause = () => {
      if (clockRef.current) clockRef.current = setPaused(clockRef.current, true)
    }
    window.addEventListener('pagehide', pause)
    return () => window.removeEventListener('pagehide', pause)
  }, [])

  const activeBank = useMemo(
    () => state.workspace.banks.find((b) => b.id === state.workspace.activeBankId) ?? null,
    [state.workspace.banks, state.workspace.activeBankId],
  )

  const api = useMemo<AppApi>(
    () => ({
      workspace: { ...state.workspace, activeSession: state.session },
      session: state.session,
      activeBank,
      addBank: (bank, assets) => dispatch({ type: 'addBank', bank, assets: assets ?? {} }),
      removeBank: (bankId) => {
        const banks = state.workspace.banks.filter((bank) => bank.id !== bankId)
        dispatch({ type: 'removeBank', bankId })
        void pruneAssetsExcept(referencedAssetIds({ ...state.workspace, banks }))
      },
      renameBank: (bankId, name) => dispatch({ type: 'renameBank', bankId, name }),
      saveChapter: (change) => {
        const result = saveChapter(state.workspace, change)
        if (state.session?.bankId === result.bankId && state.session.questionIds.some(id => result.invalidatedIds.has(id))) {
          setSessionNotice('题目内容已变更，未完成练习已结束。未受影响的作答记录仍保留。')
        }
        dispatch({ type: 'saveChapter', change })
        void pruneAssetsExcept(referencedAssetIds(result.workspace))
      },
      importChapters: (change) => {
        const result = importChapters(state.workspace, change)
        dispatch({ type: 'importChapters', change })
        void pruneAssetsExcept(referencedAssetIds(result.workspace))
      },
      deleteChapter: (bankId, category) => {
        const result = deleteChapter(state.workspace, bankId, category)
        if (state.session?.bankId === bankId && state.session.questionIds.some(id => result.invalidatedIds.has(id))) {
          setSessionNotice('练习中的题目已删除，未完成练习已结束。其他作答记录仍保留。')
        }
        dispatch({ type: 'deleteChapter', bankId, category })
        void pruneAssetsExcept(referencedAssetIds(result.workspace))
      },
      setActiveBank: (bankId) => dispatch({ type: 'setActiveBank', bankId }),
      recordAttempt: (attempt) => dispatch({ type: 'recordAttempt', attempt }),
      removeFromWrongBook: (questionId, bankId) => dispatch({
        type: 'removeFromWrongBook',
        questionId,
        bankId,
        key: statKey(bankId, questionId),
      }),
      resetBank: (bankId) => dispatch({ type: 'resetBank', bankId }),
      replaceWorkspace: (workspace) => {
        workspace = migrateStats(workspace)
        const restored = restoreSession(workspace)
        clockRef.current = restored ? createClock(restored) : null
        dispatch({ type: 'replaceWorkspace', workspace })
        void pruneAssetsExcept(referencedAssetIds(workspace))
      },
      startSessionReplacing: async (session, fromStart = false) => {
        const replaced = sessionRef.current
        if (replaced) {
          const answered = Object.keys(replaced.answers).length
          if (!await confirmAction(`还有一组未完成练习（已答 ${answered} / ${replaced.questionIds.length} 题）。开始新练习将替换它，未提交的选项将不再保留；已提交的作答记录不受影响。是否开始新练习？`)) return
          // 确认期间若已切换或结束练习，不覆盖更新后的进度。
          if (sessionRef.current?.id !== replaced.id) return
        }
        const bank = state.workspace.banks.find(bank => bank.id === session.bankId)
        if (bank && session.mode !== 'wrong' && !fromStart) {
          const remaining = remainingChapterQuestions(bank, session.mode === 'category' ? session.category : null, state.workspace)
          if (remaining.length) {
            session = buildSession(bank, { mode: session.mode, category: session.category, count: session.questionIds.length }, remaining, session.id)
          }
        }
        /* 旧的��组已经答过的题记在 attempts 里，不会白答；这里只提示一下。 */
        if (replaced) {
          const answered = Object.keys(replaced.answers).length
          setSessionNotice(answered
            ? `已结束上一组练习（已答 ${answered} 题，记录已保留），开始新的练习。`
            : '已结束上一组练习，开始新的练习。')
        }
        clockRef.current = createClock(session)
        dispatch({ type: 'startSession', session })
      },
      updateSession: (session) => {
        /* 切题会改「当前题」，秒表要跟着换起点，再落盘。 */
        const previous = sessionRef.current
        const previousId = previous ? previous.questionIds[previous.index] : null
        const nextId = session.questionIds[session.index]
        if (clockRef.current && previousId && previousId !== nextId) {
          clockRef.current = switchQuestion(clockRef.current, previousId)
        }
        dispatch({ type: 'updateSession', session: clockRef.current ? commitClock(clockRef.current, session) : session })
      },
      endSession: () => dispatch({ type: 'endSession' }),
      finishSession: (record) => dispatch({ type: 'finishSession', record }),
      clockSession: (paused) => {
        if (!clockRef.current) return
        if (paused === undefined) {
          clockRef.current = tickClock(clockRef.current)
          return
        }
        const current = state.session
        const currentId = current ? current.questionIds[current.index] : undefined
        clockRef.current = setPaused(clockRef.current, paused, currentId)
        /* 暂停/继续会改变计时口径，落盘一次。 */
        dispatch({ type: 'setPaused', paused })
      },
      sessionElapsed: () => (clockRef.current ? sessionElapsed(clockRef.current) : 0),
      questionElapsed: (questionId, answeredMs) =>
        (clockRef.current ? currentQuestionElapsed(clockRef.current, questionId, answeredMs) : answeredMs ?? 0),
      snapshotWorkspace: () => ({ ...state.workspace,
        activeSession: state.session && clockRef.current ? commitClock(clockRef.current, state.session) : state.session }),
    }),
    [state.workspace, state.session, activeBank],
  )

  return <AppContext.Provider value={api}>
    {sessionNotice ? <div className="storage-error" role="status">{sessionNotice}<button type="button" onClick={() => setSessionNotice(null)}>关闭</button></div> : null}
    {initialWorkspace.activeSession && !restoreSession(initialWorkspace) ? <div className="storage-error" role="status">未完成练习已失效，题库可能已变更。有效作答记录仍保留，可重新开始练习。</div> : null}
    {storageError ? <div className="storage-error" role="alert">{storageError}</div> : null}
    {children}
  </AppContext.Provider>
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}
