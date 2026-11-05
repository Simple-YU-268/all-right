export type UpdateStage = 'save' | 'download' | 'install'

export async function runUpdate(actions: {
  save: () => Promise<void>
  pause: () => void
  download: () => Promise<void>
  install: () => Promise<void>
}) {
  await actions.save()
  actions.pause()
  await actions.download()
  await actions.install()
}

export function updateErrorMessage(error: unknown, stage: UpdateStage): string {
  if (stage === 'save') return '进度保存失败，未开始更新；请导出备份后重试'
  if (/signature|verification|verify/i.test(String(error))) return '更新签名校验失败，未安装；请重新检查更新'
  return stage === 'download' ? '下载失败，练习已暂停；可重试或继续练习' : '安装启动失败，练习已保存；请重试'
}
