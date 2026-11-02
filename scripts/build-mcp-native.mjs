import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
mkdirSync('src-tauri/resources', { recursive: true })
const result = spawnSync('bun', ['build', 'mcp/server.mjs', '--compile', '--target=bun-windows-x64', '--outfile=src-tauri/resources/allright-mcp.exe'], { stdio: 'inherit', shell: process.platform === 'win32' })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status || 1)
