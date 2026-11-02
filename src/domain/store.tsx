import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { type AttemptRecord, type Bank, type SessionMode, type Workspace } from './types'
import { saveWorkspace } from './storage'

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
}

interface State {
  workspace: Workspace
  session: ActiveSession | null
}

type Action =
  | { type: 'addBank'; bank: Bank }
  | { type: 'removeBank'; bankId: string }
  | { type: 'renameBank'; bankId: string; name: string }
  | { type: 'setActiveBank'; bankId: string }
  | { type: 'recordAttempt'; attempt: AttemptRecord }
  | { type: 'removeFromWrongBook'; questionId: string }
  | { type: 'resetBank'; bankId: string }
  | { type: 'replaceWorkspace'; workspace: Workspace }
  | { type: 'startSession'; session: ActiveSession }
  | { type: 'updateSession'; session: ActiveSession }
  | { type: 'endSession' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addBank':
      return {
        ...state,
        workspace: {
          ...state.workspace,
          banks: [...state.workspace.banks, action.bank],
          activeBankId: action.bank.id,
        },
      }
    case 'removeBank': {
      const banks = state.workspace.banks.filter((b) => b.id !== action.bankId)
      const questionIds = new Set(
        state.workspace.banks.find((b) => b.id === action.bankId)?.questions.map((q) => q.id) ?? [],
      )
      const stats = { ...state.workspace.stats }
      for (const id of questionIds) delete stats[id]
      return {
        ...state,
        workspace: {
          ...state.workspace,
          banks,
          stats,
          attempts: state.workspace.attempts.filter((a) => a.bankId !== action.bankId),
          sessions: state.workspace.sessions.filter((s) => s.bankId !== action.bankId),
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
      const prev = state.workspace.stats[attempt.questionId]
      const consecutiveCorrect = attempt.correct ? (prev?.consecutiveCorrect ?? 0) + 1 : 0
      return {
        ...state,
        workspace: {
          ...state.workspace,
          attempts: [...state.workspace.attempts, attempt],
          stats: {
            ...state.workspace.stats,
            [attempt.questionId]: {
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
      const prev = state.workspace.stats[action.questionId]
      if (!prev) return state
      return {
        ...state,
        workspace: {
          ...state.workspace,
          stats: {
            ...state.workspace.stats,
            [action.questionId]: {
              ...prev,
              consecutiveCorrect: Math.max(1, prev.consecutiveCorrect),
            },
          },
        },
      }
    }
    case 'resetBank': {
      const questionIds = new Set(
        state.workspace.banks.find((b) => b.id === action.bankId)?.questions.map((q) => q.id) ?? [],
      )
      const stats = { ...state.workspace.stats }
      for (const id of questionIds) delete stats[id]
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
      return { ...state, workspace: action.workspace, session: null }
    case 'startSession':
      return { ...state, session: action.session }
    case 'updateSession':
      return { ...state, session: action.session }
    case 'endSession':
      return { ...state, session: null }
    default:
      return state
  }
}

export interface AppApi {
  workspace: Workspace
  session: ActiveSession | null
  activeBank: Bank | null
  addBank: (bank: Bank) => void
  removeBank: (bankId: string) => void
  renameBank: (bankId: string, name: string) => void
  setActiveBank: (bankId: string) => void
  recordAttempt: (attempt: AttemptRecord) => void
  removeFromWrongBook: (questionId: string) => void
  resetBank: (bankId: string) => void
  replaceWorkspace: (workspace: Workspace) => void
  startSession: (session: ActiveSession) => void
  updateSession: (session: ActiveSession) => void
  endSession: () => void
}

const AppContext = createContext<AppApi | null>(null)

export function AppProvider({ children, initialWorkspace }: { children: ReactNode; initialWorkspace: Workspace }) {
  const [storageError, setStorageError] = useState<string | null>(null)
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    workspace: initialWorkspace,
    session: null,
  }))

  useEffect(() => {
    let active = true
    void saveWorkspace(state.workspace).then(
      () => { if (active) setStorageError(null) },
      (error: unknown) => { if (active) setStorageError(`保存失败，请先导出备份：${String(error)}`) },
    )
    return () => { active = false }
  }, [state.workspace])

  const activeBank = useMemo(
    () => state.workspace.banks.find((b) => b.id === state.workspace.activeBankId) ?? null,
    [state.workspace.banks, state.workspace.activeBankId],
  )

  const api = useMemo<AppApi>(
    () => ({
      workspace: state.workspace,
      session: state.session,
      activeBank,
      addBank: (bank) => dispatch({ type: 'addBank', bank }),
      removeBank: (bankId) => dispatch({ type: 'removeBank', bankId }),
      renameBank: (bankId, name) => dispatch({ type: 'renameBank', bankId, name }),
      setActiveBank: (bankId) => dispatch({ type: 'setActiveBank', bankId }),
      recordAttempt: (attempt) => dispatch({ type: 'recordAttempt', attempt }),
      removeFromWrongBook: (questionId) => dispatch({ type: 'removeFromWrongBook', questionId }),
      resetBank: (bankId) => dispatch({ type: 'resetBank', bankId }),
      replaceWorkspace: (workspace) => dispatch({ type: 'replaceWorkspace', workspace }),
      startSession: (session) => dispatch({ type: 'startSession', session }),
      updateSession: (session) => dispatch({ type: 'updateSession', session }),
      endSession: () => dispatch({ type: 'endSession' }),
    }),
    [state.workspace, state.session, activeBank],
  )

  return <AppContext.Provider value={api}>
    {storageError ? <div className="storage-error" role="alert">{storageError}</div> : null}
    {children}
  </AppContext.Provider>
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}
