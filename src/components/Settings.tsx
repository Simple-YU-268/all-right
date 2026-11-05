import { ThemedButton } from './ThemedButton'
import { useRef, useState } from 'react'
import { ArrowRight, Download, FileCode as FileJson, Upload, SettingConfig, Robot, DatabaseConfig, Code } from '@icon-park/react'
import { useApp } from '../domain/store'
import { downloadBinary, downloadJson } from '../domain/storage'
import { buildWorkspaceBackup, commitRestoredAssets, readBackupFile } from '../domain/backup'
import { FIELD_ALIASES, TEMPLATE, TEMPLATE_PRETTY } from '../domain/bankTemplate'
import { useMotionPref } from '../domain/motion'
import { ThemePicker } from './ThemePicker'
import { useTheme } from '../domain/theme'
import { Tabs, TabsList, TabsTrigger } from '../vendor/looseleaf/ui/tabs'
import { Switch } from '../vendor/looseleaf/ui/switch'
import { confirmAction, DATA_PLACE, DATA_RESET, DATA_STORE, IS_TAURI } from '../domain/shell'
import type { Workspace } from '../domain/types'
import type { Route } from '../App'
import { CopyButton } from './bits'
import { ChapterGuide } from './ChapterGuide'
import { MathGuide } from './MathGuide'
import { McpSettings } from './McpSettings'
import { SessionHistory } from './SessionHistory'

export function Settings({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { workspace, replaceWorkspace, snapshotWorkspace } = useApp()
  const [motion, setMotion] = useMotionPref()
  const [theme] = useTheme()
  const backupInput = useRef<HTMLInputElement>(null)
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [section, setSection] = useState(theme === 'looseleaf' ? 'general' : 'agent')
  const sections = [
    { id: 'agent', label: 'Agent 与连接', icon: Robot },
    { id: 'format', label: '题库格式', icon: Code },
    { id: 'data', label: '数据与隐私', icon: DatabaseConfig },
    { id: 'general', label: '通用偏好', icon: SettingConfig },
  ]

  const restoreBackup = async (file: File) => {
    try {
      const backup = await readBackupFile(file)
      if (!await confirmAction(`恢复备份中的 ${backup.workspace.banks.length} 个题库及练习记录？当前本机数据将被替换，请先导出备份。`)) return
      /* 图片先落盘，全部成功了再切工作区。 */
      const restored = await commitRestoredAssets(backup.workspace, backup.files)
      replaceWorkspace(restored)
      const images = backup.files.size
      setBackupStatus(
        `已恢复 ${restored.banks.length} 个题库及练习记录${images ? `，含 ${images} 张图片` : ''}。`,
      )
    } catch (error) {
      setBackupStatus(`恢复失败：${String(error)}`)
    }
  }

  const clearAll = async () => {
    const empty: Workspace = {
      version: 2,
      banks: [],
      activeBankId: null,
      attempts: [],
      stats: {},
      sessions: [],
      assets: {},
    }
    if (!await confirmAction('清空这台电脑上的题库、练习记录和错题本？此操作不可撤销。')) return
    replaceWorkspace(empty)
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar__heading">
          <p className="topbar__title">设置</p>
          <p className="topbar__sub">管理连接、题库与本机偏好</p>
        </div>
      </header>

      <div className="content">
        <div className="content__inner">
          <div className="settings-shell">
            {theme === 'looseleaf' ? <Tabs value={section} onValueChange={setSection} className="settings-tabs">
              <TabsList variant="line" aria-label="设置分类">{sections.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><Icon size={16} />{label}</TabsTrigger>)}</TabsList>
            </Tabs> : null}
            <nav className="settings-nav" aria-label="设置分类">
              <p className="settings-nav__label">工作区设置</p>
              {sections.map(({ id, label, icon: Icon }) => (
                <ThemedButton type="button" key={id} aria-current={section === id ? 'location' : undefined} onClick={() => {
                  setSection(id)
                  document.getElementById(`settings-${id}`)?.scrollIntoView({ block: 'start' })
                }}><Icon size={17} /><span>{label}</span></ThemedButton>
              ))}
              <div className="settings-nav__footer">ALL RIGHT 全对<span>{IS_TAURI ? '桌面版 · 本地存储' : '网页版 · 本地存储'}</span></div>
            </nav>
          <div className="settings settings--workspace" data-section={section}>
            <div id="settings-agent" className="settings-section">
            <McpSettings />
            </div>
            <section id="settings-format" className="panel settings-section">
              <header className="panel__head">
                <h2 className="panel__title">题库格式</h2>
                <p className="panel__hint">JSON 模板与字段规范</p>
              </header>
              <div className="panel__body">
                <div className="settings__intro">
                  <div className="settings__intro-text">
                    <p className="t-meta">
                      把这段模板和你的题库一起发给你的 AI 助手，它会按这个结构吐回 JSON。题库页还准备了一段现成的
                      转译提示词，连模板一起复制过去就行。
                    </p>
                    <p className="t-meta settings__note">
                      <FileJson size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                      模板里的字段是标准写法；导入器本身还认一批同义写法。
                    </p>
                  </div>
                  <div className="settings__actions">
                    <CopyButton text={TEMPLATE_PRETTY} className="btn btn--sm">
                      复制模板
                    </CopyButton>
                    <ThemedButton
                      type="button"
                      className="btn btn--sm"
                      onClick={() => downloadJson('allright-题库模板.json', TEMPLATE)}
                    >
                      <Download size={13} strokeWidth={2} />
                      下载模板
                    </ThemedButton>
                    <ThemedButton type="button" className="btn btn--sm btn--ghost" onClick={() => onNavigate('banks')}>
                      去题库页
                      <ArrowRight size={13} strokeWidth={2} />
                    </ThemedButton>
                  </div>
                </div>

                <details className="settings-disclosure"><summary>章节组织规则</summary><ChapterGuide /></details>

                <details className="settings-disclosure"><summary>公式写法</summary><MathGuide /></details>

                <details className="settings-disclosure"><summary>JSON 模板与兼容字段</summary>
                <div className="schema schema--split">
                  <pre className="schema__code t-data">{TEMPLATE_PRETTY}</pre>
                  <div className="settings__fields">
                    <p className="t-label">导入器能认的字段写法</p>
                    <dl className="fields">
                      {FIELD_ALIASES.map((row) => (
                        <div className="fields__row" key={row.field}>
                          <dt className="fields__name">{row.field}</dt>
                          <dd className="fields__aliases">
                            {row.accepts.map((alias) => (
                              <code className="t-data" key={alias}>
                                {alias}
                              </code>
                            ))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
                </details>
              </div>
            </section>

            <section id="settings-data" className="panel settings-section">
              <header className="panel__head">
                <h2 className="panel__title">数据与隐私</h2>
                <p className="panel__hint">数据只在{DATA_PLACE}</p>
              </header>
              <div className="panel__body">
                <div className="settings-storage"><span>本机工作区</span><strong>{workspace.banks.length} 个题库</strong><span>{workspace.banks.reduce((sum, bank) => sum + bank.questions.length, 0)} 道题目</span><span>{workspace.attempts.length} 条作答记录</span></div>
                <p className="t-meta">
                  题库、练习记录和错题本都写在{DATA_STORE}里，{IS_TAURI ? '文件名' : '键名'}{' '}
                  <code className="t-data">{IS_TAURI ? 'workspace.json' : 'allright.workspace.v1'}</code>。不会上传，也不同步到别的设备。
                  换机器或{DATA_RESET}前，先导一份备份。
                </p>
                <div className="settings__actions">
                  <ThemedButton
                    type="button"
                    className="btn btn--sm"
                    onClick={() => {
                      void buildWorkspaceBackup(snapshotWorkspace()).then((backup) => {
                        if (backup.isPack) downloadBinary(backup.filename, backup.bytes)
                        else downloadJson(backup.filename, JSON.parse(new TextDecoder().decode(backup.bytes)))
                      }).catch((error: unknown) => setBackupStatus(`导出失败：${String(error)}`))
                    }}
                  >
                    <Download size={13} strokeWidth={2} />
                    导出备份
                  </ThemedButton>
                  <input
                    ref={backupInput}
                    type="file"
                    accept=".json,.allright,application/json"
                    hidden
                    aria-label="选择工作区备份"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void restoreBackup(file)
                      event.target.value = ''
                    }}
                  />
                  <ThemedButton type="button" className="btn btn--sm" onClick={() => backupInput.current?.click()}>
                    <Upload size={13} strokeWidth={2} />
                    恢复备份
                  </ThemedButton>
                </div>
                {backupStatus ? <p className="t-meta settings__note" role="status">{backupStatus}</p> : null}
                <details className="settings-disclosure">
                  <summary>练习历史（{workspace.sessions.length}）</summary>
                  <SessionHistory
                    sessions={workspace.sessions}
                    bankNames={new Map(workspace.banks.map((bank) => [bank.id, bank.name]))}
                  />
                </details>
                <div className="settings-danger"><div><h3>清空工作区</h3><p>删除全部题库、练习记录和错题，无法撤销。</p></div><ThemedButton type="button" className="btn btn--sm btn--danger" onClick={clearAll}>清空本机数据</ThemedButton></div>
              </div>
            </section>

            <section id="settings-general" className="panel settings-section">
              <header className="panel__head">
                <h2 className="panel__title">通用偏好</h2>
                <p className="panel__hint">显示与动态效果</p>
              </header>
              <div className="panel__body">
                <ThemePicker />
                <div className="settingrow">
                  <div className="settingrow__text">
                    <p className="settingrow__name">结算翻页</p>
                    <p className="t-meta">练习完成时播放翻页动效。</p>
                  </div>
                  {theme === 'looseleaf' ? <Switch aria-label="结算翻页" checked={motion === 'full'} onCheckedChange={checked => setMotion(checked ? 'full' : 'reduced')} /> : <input className="settings-switch" type="checkbox" role="switch" aria-label="结算翻页" checked={motion === 'full'} onChange={event => setMotion(event.target.checked ? 'full' : 'reduced')} />}
                </div>
                <p className="t-meta settings__note">
                  系统里开了「减少动态效果」时，翻页会自动跳过。
                </p>
              </div>
            </section>
          </div>
          </div>
        </div>
      </div>
    </>
  )
}
