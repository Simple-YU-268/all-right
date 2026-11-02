import { ArrowRight, Download, FileJson } from 'lucide-react'
import { useApp } from '../domain/store'
import { downloadJson } from '../domain/storage'
import { FIELD_ALIASES, TEMPLATE, TEMPLATE_PRETTY } from '../domain/bankTemplate'
import { useMotionPref, type MotionPref } from '../domain/motion'
import { DATA_PLACE, DATA_RESET, DATA_STORE } from '../domain/shell'
import type { Workspace } from '../domain/types'
import type { Route } from '../App'
import { CopyButton, Segmented } from './bits'

const MOTION_OPTIONS: { value: MotionPref; label: string }[] = [
  { value: 'full', label: '开' },
  { value: 'reduced', label: '关' },
]

export function Settings({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { workspace, replaceWorkspace } = useApp()
  const [motion, setMotion] = useMotionPref()

  const clearAll = () => {
    const empty: Workspace = {
      version: 1,
      banks: [],
      activeBankId: null,
      attempts: [],
      stats: {},
      sessions: [],
    }
    if (!window.confirm('清空这台电脑上的题库、练习记录和错题本？此操作不可撤销。')) return
    replaceWorkspace(empty)
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar__heading">
          <p className="topbar__title">设置</p>
          <p className="topbar__sub">模板、数据与动效</p>
        </div>
      </header>

      <div className="content">
        <div className="content__inner">
          <div className="settings">
            <section className="panel">
              <header className="panel__head">
                <h2 className="panel__title">AI 转译用 JSON 模板</h2>
                <p className="panel__hint">和题库一起发给 AI 助手，它会按这个结构吐回 JSON</p>
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
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => downloadJson('allright-题库模板.json', TEMPLATE)}
                    >
                      <Download size={13} strokeWidth={2} />
                      下载模板
                    </button>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => onNavigate('banks')}>
                      去题库页
                      <ArrowRight size={13} strokeWidth={2} />
                    </button>
                  </div>
                </div>

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
              </div>
            </section>

            <section className="panel">
              <header className="panel__head">
                <h2 className="panel__title">数据与隐私</h2>
                <p className="panel__hint">数据只在{DATA_PLACE}</p>
              </header>
              <div className="panel__body">
                <p className="t-meta">
                  题库、练习记录和错题本都写在{DATA_STORE}里，键名{' '}
                  <code className="t-data">allright.workspace.v1</code>。不会上传，也不同步到别的设备。
                  换机器或{DATA_RESET}前，先导一份备份。
                </p>
                <div className="settings__actions">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => downloadJson('allright-工作区备份.json', workspace)}
                  >
                    <Download size={13} strokeWidth={2} />
                    导出备份
                  </button>
                  <button type="button" className="btn btn--sm btn--danger" onClick={clearAll}>
                    清空本机数据
                  </button>
                </div>
              </div>
            </section>

            <section className="panel">
              <header className="panel__head">
                <h2 className="panel__title">动效</h2>
                <p className="panel__hint">结算时那一次纸面翻页</p>
              </header>
              <div className="panel__body">
                <div className="settingrow">
                  <div className="settingrow__text">
                    <p className="settingrow__name">结算翻页</p>
                    <p className="t-meta">练习结束时纸面翻成负片再落回数字。关掉就直接显示结算页。</p>
                  </div>
                  <Segmented
                    options={MOTION_OPTIONS}
                    value={motion}
                    onChange={setMotion}
                    label="结算翻页"
                  />
                </div>
                <p className="t-meta settings__note">
                  系统里开了「减少动态效果」时，翻页会自动跳过。
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
