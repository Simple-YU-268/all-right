import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const version = '24.20.0'
const base = `https://nodejs.org/dist/v${version}`
await mkdir('src-tauri/resources', { recursive: true })
const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text()
const expected = sums.split('\n').find(line => line.trim().endsWith('win-x64/node.exe'))?.split(/\s+/)[0]
if (!expected) throw new Error('Official Node checksum missing')
let bytes
try { bytes = await readFile('src-tauri/resources/node.exe') } catch {
  bytes = Buffer.from(await (await fetch(`${base}/win-x64/node.exe`)).arrayBuffer())
}
if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Node runtime checksum mismatch')
await writeFile('src-tauri/resources/node.exe', bytes)
const license = await fetch(`https://raw.githubusercontent.com/nodejs/node/v${version}/LICENSE`)
if (!license.ok) throw new Error('Node license download failed')
await writeFile('src-tauri/resources/NODE-LICENSE.txt', await license.text())
await build({ entryPoints: ['mcp/server.mjs'], outfile: 'src-tauri/resources/mcp-server.mjs', bundle: true,
  platform: 'node', format: 'esm', target: 'node24',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } })
await build({ entryPoints: ['mcp/selftest.mjs'], outfile: 'src-tauri/resources/mcp-selftest.mjs', bundle: true,
  platform: 'node', format: 'esm', target: 'node24',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } })
