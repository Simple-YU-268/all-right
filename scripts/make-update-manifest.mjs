import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [signatureFile, output = 'release/latest.json'] = process.argv.slice(2)
if (!signatureFile) throw new Error('Usage: node scripts/make-update-manifest.mjs <installer.exe.sig> [output]')
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const signature = (await readFile(resolve(signatureFile), 'utf8')).trim()
if (!signature) throw new Error('Signature is empty')
const notes = await readFile(new URL(`../docs/releases/v${version}.md`, import.meta.url), 'utf8')
await writeFile(resolve(output), JSON.stringify({
  version, notes, pub_date: new Date().toISOString(),
  platforms: { 'windows-x86_64': {
    signature,
    url: `https://github.com/Simple-YU-268/all-right/releases/download/v${version}/ALLRIGHT-Setup-${version}.exe`,
  } },
}, null, 2) + '\n')
console.log(`Generated ${output} for v${version}`)
