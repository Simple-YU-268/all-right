import assert from 'node:assert/strict'
import { loadAppModule } from './lib/load-app-module.mjs'
const { runUpdate, updateErrorMessage } = await loadAppModule('src/domain/updateFlow.ts')
for (const failure of ['save', 'download', 'install', null]) {
  const calls = []
  const action = name => async () => { calls.push(name); if (failure === name) throw new Error(name) }
  const result = runUpdate({ save: action('save'), pause: () => calls.push('pause'), download: action('download'), install: action('install') })
  if (failure) await assert.rejects(result)
  else await result
  assert.deepEqual(calls, failure === 'save' ? ['save'] : failure === 'download' ? ['save', 'pause', 'download'] : ['save', 'pause', 'download', 'install'])
}
assert.match(updateErrorMessage(new Error('signature verification failed'), 'download'), /签名/)
assert.match(updateErrorMessage(new Error('disk full'), 'save'), /保存失败/)
console.log('PASS updater save gate, interrupted download, install failure, retry sequence and signature feedback')
