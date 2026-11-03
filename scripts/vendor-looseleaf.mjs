import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const revision = '4bdb647940e2fefb3cebb394f3bad25c766a27d2'
const base = `https://raw.githubusercontent.com/kevintngo/looseleaf/${revision}`
const directory = 'src/vendor/looseleaf'
await mkdir('public/fonts/looseleaf', { recursive: true })
async function download(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status}: ${url}`)
  return response
}
const tree = await (await download(`https://api.github.com/repos/kevintngo/looseleaf/git/trees/${revision}?recursive=1`)).json()
const extrasOnly = process.argv.includes('--extras-only')
const files = extrasOnly ? [] : tree.tree.filter(file => file.type === 'blob' && file.path.startsWith('src/lib/ink/')).map(file => file.path)
const components = ['button', 'paper', 'tabs', 'badge', 'input', 'textarea', 'checkbox', 'radio-group', 'select', 'progress', 'separator', 'switch', 'tooltip', 'dropdown-menu', 'alert', 'label', 'table']
if (!extrasOnly) files.push('src/lib/utils.ts', 'src/styles/looseleaf.css', 'src/styles/fonts.css', ...components.map(name => `src/components/ui/${name}.tsx`))
files.push('src/lib/field-class.ts', 'src/lib/menu-styles.ts')
const destination = name => `${directory}/${name.replace('src/lib/ink/', 'ink/').replace('src/components/ui/', 'ui/').replace('src/lib/', '').replace('src/styles/', 'styles/')}`
for (let index = 0; index < files.length; index++) {
  const name = files[index]
  let source = await (await download(`${base}/${name}`)).text()
  const target = destination(name)
  for (const match of source.matchAll(/['"](@\/[^'"]+)['"]/g)) {
    const alias = match[1]
    const upstream = `src/${alias.slice(2)}`
    if (upstream.startsWith('src/components/ui/') && !files.some(file => file === `${upstream}.tsx`)) files.push(`${upstream}.tsx`)
    const relative = path.posix.relative(path.posix.dirname(target), destination(upstream))
    source = source.replaceAll(alias, relative.startsWith('.') ? relative : `./${relative}`)
  }
  if (name === 'src/styles/fonts.css') source = source.replaceAll('./fonts/', '/fonts/looseleaf/').replace(/^@import .*;\r?\n/gm, '')
  if (name === 'src/lib/ink/react/defs.tsx') source = source.replace('https://kevintngo.github.io/looseleaf/fonts/kevin-sans.css', `${'/fonts/looseleaf/'}kevin-sans.css`)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, source)
}
const license = await (await download(`${base}/LICENSE`)).text()
await writeFile(`${directory}/LICENSE`, license)
await writeFile('public/fonts/looseleaf/LICENSE', license)
for (const name of ['KevinSans-Regular.woff2', 'KevinSans-Bold.woff2']) {
  const bytes = await (await download(`${base}/src/styles/fonts/${name}`)).arrayBuffer()
  await writeFile(`public/fonts/looseleaf/${name}`, new Uint8Array(bytes))
}
await writeFile('public/fonts/looseleaf/kevin-sans.css', (await (await download(`${base}/src/styles/fonts.css`)).text()).replaceAll('./fonts/', './').replace(/^@import .*;\r?\n/gm, ''))
await writeFile(`${directory}/SOURCE.md`, `# Looseleaf\n\nSource: https://github.com/kevintngo/looseleaf\nRevision: ${revision}\nLicense: MIT (see LICENSE)\n\nOriginal React components, ink engine, paper textures, theme, and Kevin Sans fonts by Kevin Ngo. Imports rewritten to relative paths. Font fallback uses local assets. Theme CSS is compiled and scoped to .ll-ui by scripts/build-looseleaf-css.mjs. Run node scripts/vendor-looseleaf.mjs to restore this pinned version.\n`)
console.log(`Vendored Looseleaf ${revision}`)
