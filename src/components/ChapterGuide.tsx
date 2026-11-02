export function ChapterGuide() {
  return (
    <section className="chapter-guide" aria-label="章节管理说明">
      <h3 className="chapter-guide__title">章节怎么管理</h3>
      <p className="t-meta">
        每道题的 <code className="t-data">category</code> 就是章节名。同一题库中，相同名称的题归为一章，
        不同名称生成不同章节入口，不需要单独创建章节列表。
      </p>
      <p className="t-meta">
        例如模板中 q1、q2 的 <code className="t-data">category</code> 都是「第一章 基础知识」，
        会合为一章；q3 使用「第二章 进阶应用」，会单独成章。
        章节按首次出现的顺序排列，章内按题目顺序练习；未填写章节的题进入「未分类」。
      </p>
      <ol className="chapter-guide__steps t-meta">
        <li>新增章节：给该章题目填写一个新的 category 名称。</li>
        <li>重命名或合并：将相关题目的 category 统一改为目标章节名；调整题目顺序可以改变章节顺序。</li>
        <li>删除章节：从 JSON 中移除该章题目，或将它们改到其他章节；没有题目的章节不会显示。</li>
      </ol>
      <p className="t-meta">
        修改前先导出工作区备份，再导出对应题库 JSON，修改 category 后重新导入。
        当前页面通过 JSON 管理章节，重新导入会创建一个新题库，不会覆盖原题库或自动合并练习记录。
        确认新题库正确后，可自行删除旧题库；保留旧题库即可保留其记录。
      </p>
    </section>
  )
}
