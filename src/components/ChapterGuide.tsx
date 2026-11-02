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
        <li>导入章节：在目标题库选择或粘贴 JSON。多章文件默认全选，可勾选部分章节，一次导入后按 category 自动分章；同名章节追加题目，已有记录保留。单章文件可填写新的章节名。</li>
        <li>编辑章节：展开「查看章节」，点击该章的「编辑章节」修改章名和题目 JSON；点击「导入题目」可以追加或替换该章。</li>
        <li>单章导出与删除：使用章节行内的「导出」或「删除章节」。删除会清理该章题目和练习记录，其他章节保留。</li>
      </ol>
      <p className="t-meta">
        章节操作直接更新目标题库，不会新建题库。仅改章名、解析、标签或难度会保留练习记录；
        修改题干、题型、选项、答案或移除题目时，会在确认后清理对应记录。新导入的重复题号自动重新编号。
        修改前可先导出工作区备份；上方整库导入仍会创建一个新题库。
      </p>
    </section>
  )
}
