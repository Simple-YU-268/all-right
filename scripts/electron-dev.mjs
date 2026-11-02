/* 桌面版开发模式：先起 Vite，等端口通了再拉起 Electron
   跑法：npm run electron:dev */
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

function ping(port) {
  /* Vite 绑的是 localhost，可能只监听 ::1，也可能只监听 127.0.0.1，
     两个都试一遍 */
  const hosts = ['::1', '127.0.0.1']
  return hosts.reduce(
    (chain, host) =>
      chain.then((found) => {
        if (found) return true
        return new Promise((res) => {
          const client = createConnection({ port, host })
          client.on('connect', () => {
            client.destroy()
            res(true)
          })
          client.on('error', () => res(false))
          client.setTimeout(500, () => {
            client.destroy()
            res(false)
          })
        })
      }),
    Promise.resolve(false),
  )
}

/* Vite 的端口不固定（5173 被占就自动换一个），从它的输出里读实际端口 */
let devUrl = null
const findUrl = (chunk) => {
  const m = String(chunk).match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)\/?/)
  if (m) devUrl = `http://localhost:${m[1]}/`
}

const vite = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  cwd: ROOT,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: isWin,
  /* 开发模式下页面走的是 http://localhost，没有 app:// 可认，
     靠这个环境变量告诉前端「你现在跑在桌面壳里」 */
  env: { ...process.env, VITE_DESKTOP: '1' },
})
vite.stdout.on('data', (c) => {
  findUrl(c)
  process.stdout.write(c)
})
vite.stderr.on('data', (c) => {
  findUrl(c)
  process.stderr.write(c)
})

let electron = null

async function waitForVite() {
  for (let i = 0; i < 120; i++) {
    if (devUrl && (await ping(Number(new URL(devUrl).port)))) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

if (!(await waitForVite())) {
  console.error('Vite 没起来，放弃启动 Electron')
  vite.kill()
  process.exit(1)
}

console.log(`\n启动 Electron，连的是 ${devUrl}\n`)
electron = spawn(isWin ? 'npx.cmd' : 'npx', ['electron', ROOT], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: isWin,
  env: { ...process.env, VITE_DEV_SERVER_URL: devUrl },
})

const shutdown = () => {
  electron?.kill()
  vite.kill()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
electron.on('exit', () => {
  vite.kill()
  process.exit(0)
})
