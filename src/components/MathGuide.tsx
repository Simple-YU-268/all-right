export function MathGuide() {
  return (
    <section className="chapter-guide" aria-label="公式写法说明">
      <h3 className="chapter-guide__title">公式怎么写</h3>
      <p className="t-meta">
        题干、选项、解析里的数学公式可以直接写 LaTeX，导入后自动排版，不必再转成图片。
      </p>
      <ol className="chapter-guide__steps t-meta">
        <li><code className="t-data">{'$x^2+y^2=z^2$'}</code>：行内公式，夹在正文里。</li>
        <li><code className="t-data">{'$$\\frac{a}{b}$$'}</code>：独立成行的公式。</li>
        <li><code className="t-data">{'\\(x^2\\)'}</code> 与 <code className="t-data">{'\\[x^2\\]'}</code>：另一种常见写法，同样认。</li>
      </ol>
      <p className="t-meta">
        公式写坏了不会让题目消失：排不了版的公式会照原文显示，其它文字照常读。
      </p>
    </section>
  )
}
