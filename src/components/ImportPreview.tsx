import { useMemo } from 'react'
import type { ParsedBank } from '../domain/parseBank'
import type { Bank } from '../domain/types'

export function ChapterDistribution({ questions }: { questions: Bank['questions'] }) {
  const chapters = new Map<string, number>()
  for (const question of questions) chapters.set(question.category, (chapters.get(question.category) ?? 0) + 1)
  return (
    <details className="chapter-distribution">
      <summary>查看章节（{chapters.size}）</summary>
      <ul aria-label="章节分布">
        {[...chapters].map(([name, count]) => (
          <li key={name}>
            <span>{name}</span>
            <span className="t-data">{count} 题</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export function PreviewStats({ parsed, imageCount = 0 }: { parsed: ParsedBank; imageCount?: number }) {
  const stats = useMemo(() => {
    const questions = parsed.valid
    const categories = new Set(questions.map((q) => q.category)).size
    const types = { single: 0, multiple: 0, judge: 0 }
    for (const q of questions) types[q.type] += 1
    return { categories, types, total: questions.length, images: imageCount }
  }, [parsed, imageCount])
  return (
    <div className="preview__stats">
      <div className="preview__stat">
        <span className="t-label">可导入题目</span>
        <b>{stats.total}</b>
      </div>
      <div className="preview__stat">
        <span className="t-label">章节数</span>
        <b>{stats.categories}</b>
      </div>
      <div className="preview__stat">
        <span className="t-label">单选</span>
        <b>{stats.types.single}</b>
      </div>
      <div className="preview__stat">
        <span className="t-label">多选</span>
        <b>{stats.types.multiple}</b>
      </div>
      <div className="preview__stat">
        <span className="t-label">判断</span>
        <b>{stats.types.judge}</b>
      </div>
      {stats.images > 0 ? (
        <div className="preview__stat">
          <span className="t-label">配图</span>
          <b>{stats.images}</b>
        </div>
      ) : null}
    </div>
  )
}

export function PreviewIssues({ parsed }: { parsed: ParsedBank }) {
  const accepted = new Set(parsed.sourceIndices ?? [])
  return (
    <>
      {parsed.sourceCount !== undefined ? <details className="chapter-distribution">
        <summary>源题对账：{parsed.sourceCount} 题 = 可导入 {parsed.valid.length} 题 + 待处理 {parsed.sourceCount - parsed.valid.length} 题</summary>
        <ul aria-label="逐题校验报告">{Array.from({ length: parsed.sourceCount }, (_, index) => <li key={index}>
          <span>源题 {index + 1}</span><span>{accepted.has(index) ? '可导入' : parsed.issues.filter(issue => issue.index === index + 1).map(issue => `${issue.field}：${issue.message}`).join('；') || '未通过校验'}</span>
        </li>)}</ul>
      </details> : null}
      {parsed.issues.length > 0 ? (
        <div className="issues">
          <p className="t-label" style={{ color: 'var(--wrong)', marginBottom: 'var(--s2)' }}>
            {parsed.issues.length} 处需要确认
          </p>
          {parsed.issues.slice(0, 40).map((issue, i) => (
            <p className="issue" key={`${issue.index}-${i}`}>
              <span className="issue__where">{issue.index ? `第 ${issue.index} 题` : '文件'}</span>
              <span>
                {issue.field}：{issue.message}
              </span>
            </p>
          ))}
          {parsed.issues.length > 40 ? (
            <p className="issue">还有 {parsed.issues.length - 40} 处未显示</p>
          ) : null}
        </div>
      ) : null}
      {parsed.warnings.length > 0 ? (
        <div className="issues">
          {parsed.warnings.slice(0, 10).map((warning, i) => (
            <p className="issue" key={i}>
              <span className="issue__where">提示</span>
              <span>{warning}</span>
            </p>
          ))}
        </div>
      ) : null}
    </>
  )
}
