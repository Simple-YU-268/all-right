import { build } from 'esbuild'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
const directory = await mkdtemp(join(tmpdir(), 'allright-mcp-'))
const outfile = join(directory, 'server.mjs')
await build({ entryPoints: [fileURLToPath(new URL('server.mjs', import.meta.url))], outfile,
  bundle: true, platform: 'node', format: 'esm', banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, logLevel: 'silent' })
await import(pathToFileURL(outfile).href)
