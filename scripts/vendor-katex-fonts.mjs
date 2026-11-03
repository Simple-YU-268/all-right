/* 把 KaTeX 的字体搬进 public/fonts/katex/：
   - 只留 woff2（woff/ttf 是旧浏览器的备份，本应用用不到，省一半体积）
   - 字体路径写成相对路径（./），这份 CSS 挂在域名根目录还是子目录下都能找到同目录的字体
   - 连同 MIT 许可证原文一起放进去
   跑法：npm run vendor:katex-fonts（升级 katex 后重跑一次） */
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = path.join(root, 'node_modules', 'katex', 'dist')
const target = path.join(root, 'public', 'fonts', 'katex')

await fs.mkdir(target, { recursive: true })

const fonts = (await fs.readdir(path.join(source, 'fonts'))).filter((name) => name.endsWith('.woff2'))
for (const font of fonts) {
  await fs.copyFile(path.join(source, 'fonts', font), path.join(target, font))
}

const css = await fs.readFile(path.join(source, 'katex.min.css'), 'utf8')
const trimmed = css
  /* 只留 woff2 这一档来源 */
  .replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\),url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, '')
  .replace(/url\(fonts\//g, 'url(./')
const header = '/* 由 scripts/vendor-katex-fonts.mjs 生成，请勿手改。\n   KaTeX 字体与样式来自 KaTeX v'
  + (JSON.parse(await fs.readFile(path.join(root, 'node_modules', 'katex', 'package.json'), 'utf8')).version)
  + '，MIT 许可证见同目录 LICENSE。 */\n'
await fs.writeFile(path.join(target, 'katex.css'), header + trimmed, 'utf8')
await fs.copyFile(path.join(root, 'node_modules', 'katex', 'LICENSE'), path.join(target, 'LICENSE'))

console.log(`Vendored ${fonts.length} KaTeX woff2 fonts into public/fonts/katex`)
