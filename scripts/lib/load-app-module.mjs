/* Node 里直接 import 应用的 TS 模块：ESM 不认无扩展名的相对路径，
   所以先用 esbuild 打包一份再加载。 */
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function loadAppModule(entry) {
  const directory = mkdtempSync(join(tmpdir(), 'allright-module-'))
  const outfile = join(directory, 'bundle.mjs')
  await build({
    entryPoints: [resolve(entry)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    /* Vite 的 import.meta.env 在 esbuild 里没有对应物，垫一个够用的。 */
    define: {
      'import.meta.env': JSON.stringify({ VITE_DESKTOP: '0', BASE_URL: '/' }),
    },
    outfile,
    logLevel: 'silent',
  })
  return import(pathToFileURL(outfile).href)
}
