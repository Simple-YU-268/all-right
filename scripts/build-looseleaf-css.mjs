import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

const directory = 'src/vendor/looseleaf/styles'
let source = await readFile(`${directory}/looseleaf.css`, 'utf8')
source = source.replace('@import "tailwindcss";', '@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css" layer(utilities) source(none);')
// Tailwind's own entry declares this layer order. Replacing the `@import "tailwindcss"` line
// above drops it, so `components` would be appended after `utilities` and win the cascade.
// That flips `position: relative` on every ink host over the component's own positioning
// utility, which silently collapses the progress fill to zero height.
source = '@layer theme, base, components, utilities;\n' + source
source += '\n@source "../";\n@source "../../../components";\n'
await writeFile(`${directory}/build-entry.css`, source)
await mkdir('.impeccable/build', { recursive: true })
execFileSync(process.execPath, ['node_modules/@tailwindcss/cli/dist/index.mjs', '-i', `${directory}/build-entry.css`, '-o', '.impeccable/build/looseleaf.css'], { stdio: 'inherit' })
const root = postcss.parse(await readFile('.impeccable/build/looseleaf.css', 'utf8'))
root.walkRules(rule => {
  let parent = rule.parent
  while (parent) {
    if (parent.type === 'rule' || (parent.type === 'atrule' && parent.name.endsWith('keyframes'))) return
    parent = parent.parent
  }
  rule.selector = selectorParser(selectors => {
    selectors.each(selector => {
      let isRoot = false
      selector.walkPseudos(node => {
        if (node.value === ':root' || node.value === ':host') {
          node.replaceWith(selectorParser.className({ value: 'll-ui' }))
          isRoot = true
        }
      })
      if (selector.nodes[0]?.type === 'tag' && ['html', 'body'].includes(selector.nodes[0].value)) {
        selector.nodes[0].replaceWith(selectorParser.className({ value: 'll-ui' }))
        isRoot = true
      }
      if (!isRoot) {
        selector.prepend(selectorParser.combinator({ value: ' ' }))
        selector.prepend(selectorParser.className({ value: 'll-ui' }))
      }
    })
  }).processSync(rule.selector)
})
await writeFile('src/styles/looseleaf.generated.css', `/* Generated from pinned Looseleaf sources. Run npm run build:looseleaf-css. */\n${root.toString()}`)
console.log('Generated isolated Looseleaf component styles')
