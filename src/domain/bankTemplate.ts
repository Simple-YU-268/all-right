/** 题库 JSON 的标准形状：导入器认这个，AI 助手也按这个转译。 */
export const TEMPLATE = {
  name: '我的题库',
  questions: [
    {
      id: 'q1',
      type: 'single',
      category: '第一章 基础知识',
      stem: '这里写题干。',
      options: [
        { key: 'A', text: '选项一' },
        { key: 'B', text: '选项二' },
        { key: 'C', text: '选项三' },
        { key: 'D', text: '选项四' },
      ],
      answer: ['A'],
      explanation: '这里写解析。',
      difficulty: 2,
      tags: ['常考'],
    },
    {
      id: 'q2',
      type: 'single',
      category: '第一章 基础知识',
      stem: '同一章的另一道题，category 与上一题完全相同。',
      options: [
        { key: 'A', text: '选项一' },
        { key: 'B', text: '选项二' },
      ],
      answer: ['B'],
      explanation: 'q1 和 q2 会归入同一个章节入口。',
      difficulty: 2,
      tags: [],
    },
    {
      id: 'q3',
      type: 'single',
      category: '第二章 进阶应用',
      stem: '另一章的题目，使用不同的 category。',
      options: [
        { key: 'A', text: '选项一' },
        { key: 'B', text: '选项二' },
      ],
      answer: ['A'],
      explanation: '不同的 category 会生成另一个章节入口。',
      difficulty: 3,
      tags: [],
    },
  ],
}

/** 紧凑打印模板：短数组和短对象压成一行，别把示例摊成三十行代码墙。 */
export function compactJson(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  const padIn = '  '.repeat(indent + 1)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.every((v) => typeof v !== 'object' || v === null)) {
      return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`
    }
    const items = value.map((v) => `${padIn}${compactJson(v, indent + 1)}`)
    return `[\n${items.join(',\n')}\n${pad}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    if (entries.every(([, v]) => typeof v !== 'object' || v === null)) {
      const inline = `{ ${entries
        .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
        .join(', ')} }`
      if (inline.length <= 64) return inline
    }
    const items = entries.map(([k, v]) => `${padIn}${JSON.stringify(k)}: ${compactJson(v, indent + 1)}`)
    return `{\n${items.join(',\n')}\n${pad}}`
  }
  return JSON.stringify(value)
}

export const TEMPLATE_PRETTY = compactJson(TEMPLATE)

/** 导入器能认的字段写法，给人看，也给 AI 助手看。 */
export const FIELD_ALIASES: { field: string; accepts: string[] }[] = [
  {
    field: '根节点',
    accepts: ['直接是题目数组', '{ name, questions }', 'questions / items / data / list', '题目 / 试题'],
  },
  { field: '题干 stem', accepts: ['stem', 'question', 'title', '题干', '题目', '问题', 'content'] },
  {
    field: '选项 options',
    accepts: ['options', 'choices', '选项', 'answers', '对象数组 / 字符串数组 / { A: "…" } 键值表'],
  },
  {
    field: '答案 answer',
    accepts: ['answer', 'correct', 'correctAnswer', '答案', '"A"', '"AB"', '["A","B"]', 'true / false'],
  },
  { field: '解析 explanation', accepts: ['explanation', 'analysis', '解析', '答案解析', '说明', 'note'] },
  { field: '章节 category', accepts: ['category', 'chapter', 'section', '分类', '章节', '目录', 'knowledge'] },
  { field: '难度 difficulty', accepts: ['difficulty', 'level', '难度', 'star', 'easy / medium / hard', '1–5'] },
  { field: '标签 tags', accepts: ['tags', 'label', 'labels', '标签', '知识点'] },
  {
    field: '题型 type',
    accepts: ['type', '题型', 'questionType', 'single / multiple / judge', '单选 / 多选 / 判断'],
  },
  { field: '编号 id', accepts: ['id', 'key', 'code', '编号', '题号'] },
]

const PROMPT_HEAD = [
  '你是一个题库格式转换器。用户会把一份任意格式的题库发给你（CSV、Excel 粘贴的文本、Word/PDF 抽取出的文本、Markdown、JSON，或某个题库网站导出的文件）。请把它转换成 ALL RIGHT 全对能导入的 JSON。',
  '',
  '输出要求：只输出一个 JSON 对象，不要任何解释文字，不要 Markdown 代码块标记，不要前后缀。必须是合法的 UTF-8 JSON，不要注释，不要尾逗号。',
  '',
  '结构（严格照抄这些字段名）：',
].join('\n')

const PROMPT_RULES = [
  '转换规则：',
  '1. 题干：取题目的正文。去掉题号、"（　）"、"[]" 这类噪声，保留题干里的标点。换行和 Tab 换成普通空格。',
  '2. 选项：按原文出现顺序依次标成 A、B、C、D…（超过四个也照排，用 E、F…）。原文写成 "1." "①" "(A)" "、" 都可以，只要顺序对。',
  '3. 答案：从"正确答案 / 参考答案 / 答案"行、"解析"行里的"故选 X"，或原文的字母标记里提取。单个字母是单选；多个字母（"AB"、"A、B"、"AC"）是多选；"正确/错误"、"对/错"、"√/×"、"T/F"、"true/false" 是判断题，answer 写 ["正确"] 或 ["错误"]。答案里出现选项中没有的字母时不要硬凑，跳过这道题。',
  '4. 解析：取原文的解析 / 说明 / 知识点讲解。没有就留空字符串 ""，不要自己编。',
  '5. 章节：每道题用 category 填写完整的章节名称（例如 "第一章 基础知识"）。同一章的所有题必须使用完全相同的名称，不同章使用不同名称；按原目录顺序排列题目，软件按章节第一次出现的顺序生成入口，无需额外创建 chapters 数组。没有章节信息就填 "未分类"。模板中的 q1、q2 属于同一章，q3 属于另一章。',
  '6. 难度：原文有难度星级或难度字段就换算成 1–5 的数字，没有就填 3。',
  '7. 标签：取原文的知识点或标签，没有就给空数组 []。',
  '8. id：保留原文的题号（字符串），确保同一题库内不重复，不要在每个章节重新从 q1 编号。没有就依次写 "q1"、"q2"…',
  '9. 不要臆造。读不出来、答案缺失、选项不全的题一律跳过，并把它的题号和原因写进根节点的 "_skipped" 数组，例如 [{"id":"12","reason":"缺少答案"}]。没有跳过项就不要输出这个字段。',
  '10. 题目再多也要全部转完，不要截断，不要用 "..." 省略。',
  '11. 公式：题干、选项、解析里的数学公式保留原来的 LaTeX 写法，行内公式用 $...$ 包起来，独立成行的用 $$...$$；不要改成图片，也不要改写成纯文本。',
  '',
  '最后把结果保存成 .json 文件，并在回复里只说明两件事：转换了多少题、跳过了多少题。',
].join('\n')

/**
 * 给用户拿去喂自己 AI 助手的转译提示词。
 * 模板直接嵌在提示词里，助手不需要额外上下文就能产出可导入的 JSON。
 */
export const AI_PROMPT = [PROMPT_HEAD, TEMPLATE_PRETTY, '', PROMPT_RULES].join('\n')
