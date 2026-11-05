/* 图片题端到端：导入题库包 → 看图 → 放大 → 答 → 备份 → 恢复
   跑法：npm run verify:image-questions（需要 dev server 跑在 5173） */
import assert from 'node:assert/strict'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, zipSync, strToU8 } from 'fflate'
import { chromium } from 'playwright-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PACK = join(ROOT, 'public', 'sample-image-bank.allright')

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('dialog', (dialog) => void dialog.accept())

const rail = (label) => page.locator('.rail__item').filter({ hasText: label }).first()

/**
 * 造一个「文件头像 PNG、内容已经坏了」的包：
 * 文件头骗得过类型嗅探，但浏览器解不开——这种图得在导入时就被挡下。
 */
function buildBrokenPack() {
  const entries = unzipSync(new Uint8Array(readFileSync(PACK)))
  const assetName = Object.keys(entries).find((name) => name.startsWith('assets/'))
  const original = entries[assetName]
  const broken = new Uint8Array(original)
  /* 越过签名与 IHDR，把 IDAT 里的数据搅乱 */
  broken[40] ^= 0xff
  broken[41] ^= 0xff
  const id = 'b'.repeat(64)
  const manifest = {
    schemaVersion: 2,
    kind: 'bank',
    name: '坏图题库',
    assets: { [id]: { file: `assets/${id}`, mime: 'image/png', bytes: broken.length } },
    questions: [{
      id: 'broken',
      type: 'single',
      category: '坏图章',
      stem: '这张图坏了',
      stemBlocks: [
        { type: 'text', text: '这张图坏了' },
        { type: 'image', assetId: id, alt: '一张解不开的图' },
      ],
      options: [{ key: 'A', text: '看图' }],
      answer: ['A'],
      explanation: '',
      difficulty: 1,
      tags: [],
    }],
  }
  const bytes = zipSync({
    'bank.json': strToU8(JSON.stringify(manifest)),
    [`assets/${id}`]: broken,
  })
  const path = join(ROOT, 'release', 'verify-broken-image.allright')
  writeFileSync(path, bytes)
  return path
}

try {
  await page.goto(process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  /* 1. 导入题库包 */
  await rail('题库').click()
  await page.waitForTimeout(300)
  await page.locator('.dropzone input[type=file]').setInputFiles(PACK)
  await page.waitForSelector('.preview', { timeout: 8000 })
  assert.match(await page.locator('.preview__title').innerText(), /导入预览/)
  const statLabels = await page.locator('.preview__stat .t-label').allTextContents()
  assert.ok(statLabels.includes('配图'), '导入预览给出配图数量')
  const imageStat = await page.locator('.preview__stat').filter({ hasText: '配图' }).locator('b').innerText()
  assert.equal(imageStat, '3', '示例题库包带 3 张图片')
  const importButton = page.getByRole('button', { name: /^导入 \d+ 题$/ })
  assert.equal(await importButton.count(), 1)
  await importButton.click()
  await page.waitForTimeout(800)

  /* 2. 练习页看图 */
  await rail('练习').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '开始新练习', exact: true }).click()
  await page.getByRole('button', { name: '按章节', exact: true }).click()
  await page.locator('.chapter-entry').first().click()
  await page.waitForSelector('.practice__stem', { timeout: 8000 })
  await page.waitForSelector('.media__img', { timeout: 8000 })
  const stemImage = page.locator('.practice .media__img').first()
  assert.equal(await stemImage.count(), 1, '题干渲染出图片')
  assert.match(await stemImage.getAttribute('src'), /^blob:/, '图片来自本地资源仓库')
  assert.match(await stemImage.getAttribute('alt'), /电路示意图/, '图片有可读的替代文字')
  assert.ok(await stemImage.evaluate((img) => img.naturalWidth > 0), '图片真的解码出来了')

  /* 3. 放大预览 */
  await stemImage.click()
  await page.waitForSelector('.viewer', { timeout: 5000 })
  assert.match(await page.locator('.viewer__title').innerText(), /电路示意图/)
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', '预览锁定背景滚动')
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '放大', '预览焦点从关闭按钮循环回可用工具')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '关闭预览', '反向焦点不离开预览窗口')
  const before = await page.locator('.viewer__img').evaluate((img) => img.getBoundingClientRect().width)
  await page.locator('.viewer__tool[aria-label="放大"]').click()
  await page.waitForTimeout(200)
  const after = await page.locator('.viewer__img').evaluate((img) => img.getBoundingClientRect().width)
  assert.ok(after > before, '放大后图片变大')
  await page.locator('.viewer__tool[aria-label="缩小"]').click()
  await page.waitForTimeout(200)
  assert.match(await page.locator('.viewer__img').getAttribute('style'), /translate\(0px, 0px\) scale\(1\)/, '缩回原尺寸归位')
  await page.screenshot({ path: '.impeccable/review/viewer-polished.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  assert.equal(await page.locator('.viewer').count(), 0, 'Esc 关掉预览')
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', '关闭恢复背景滚动')

  /* 4. 答一题，记录进错题本 */
  await page.getByRole('button', { name: /各处电流一定不同/ }).click()
  await page.getByRole('button', { name: '确认答案', exact: true }).click()
  await page.waitForTimeout(400)
  assert.match(await page.locator('.result').innerText(), /答错了/)
  await page.locator('.explain .media__img').first().waitFor({ timeout: 5000 })
  assert.equal(await page.locator('.explain .media__img').count(), 1, '解析里也渲染出配图')

  assert.match(await page.locator('.practice__counter').innerText(), /第 1 \/ 2 题/)
  assert.equal(await page.locator('.explain .media__img').count(), 1, '答错后停留显示解析配图')

  /* 这一章还有一题，练完才回得到练习首页 */
  await page.getByRole('button', { name: '下一题' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /这段信号是直流量/ }).click()
  await page.getByRole('button', { name: '确认答案', exact: true }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '看本次结算', exact: true }).click()
  await page.locator('.summary').waitFor({ timeout: 8000 })
  await page.locator('.wrongrow .explain__body .media__img').waitFor({ timeout: 5000 })
  await rail('错题本').click()
  await page.locator('.wrongrow .explain__body .media__img').waitFor({ timeout: 5000 })

  /* 5. 图片选项：点图不等于选答案 */
  await rail('看板').click()
  await page.waitForTimeout(300)
  await rail('练习').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '开始新练习', exact: true }).click()
  await page.getByRole('button', { name: '按章节', exact: true }).click()
  await page.locator('.chapter-entry').filter({ hasText: '第二章' }).click()
  await page.waitForSelector('.option__media', { timeout: 8000 })
  const optionImage = page.locator('.option__media .media__img').first()
  await optionImage.waitFor({ timeout: 5000 })
  await optionImage.click()
  await page.waitForTimeout(300)
  assert.equal(await page.locator('.viewer').count(), 1, '点选项里的图会打开预览')
  const pressed = await page.locator('.option__pick').first().getAttribute('aria-pressed')
  assert.equal(pressed, 'false', '放大图片不会顺手把选项勾上')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /水平的一条直线/ }).click()
  assert.equal(
    await page.locator('.option__pick').first().getAttribute('aria-pressed'),
    'true',
    '点文字才选中选项',
  )

  /* 6. 导出备份：带图就该是完整的包 */
  await rail('设置').click()
  await page.waitForTimeout(300)
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.getByRole('button', { name: '导出备份', exact: true }).click(),
  ])
  const backupPath = join(ROOT, 'release', 'verify-image-backup.allright')
  await download.saveAs(backupPath)
  assert.equal(download.suggestedFilename(), 'allright-工作区备份.allright')
  const size = statSync(backupPath).size
  assert.ok(size > 3000, `备份包带着图片（${size} 字节）`)
  const head = readFileSync(backupPath).subarray(0, 2).toString('latin1')
  assert.equal(head, 'PK', '备份是 zip 容器')

  /* 7. 删掉一张图，这题就不该让人提交 */
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('allright-assets', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      tx.objectStore('files').clear()
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  })
  await page.reload()
  await page.waitForTimeout(600)
  await rail('练习').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '结束并结算', exact: true }).click()
  await page.getByRole('button', { name: '去看板', exact: true }).click()
  await rail('练习').click()
  await page.getByRole('button', { name: '开始新练习', exact: true }).click()
  await page.getByRole('button', { name: '按章节', exact: true }).click()
  await page.getByRole('button', { name: '从头重练', exact: true }).click()
  await page.locator('.chapter-entry').first().click()
  await page.waitForSelector('.media--missing', { timeout: 8000 })
  assert.match(await page.locator('.practice').innerText(), /这张图没加载出来/)
  await page.getByRole('button', { name: /各处电流相等/ }).click()
  const submit = page.getByRole('button', { name: '确认答案', exact: true })
  assert.equal(await submit.isDisabled(), true, '图没加载出来时不能提交')
  assert.match(await page.locator('.practice').innerText(), /有图片没加载出来/)

  /* 8. 恢复备份：图片也得回来 */
  await rail('设置').click()
  await page.waitForTimeout(300)
  await page.getByLabel('选择工作区备份').setInputFiles(backupPath)
  await page.getByRole('status').filter({ hasText: '已恢复' }).waitFor({ timeout: 8000 })
  assert.match(await page.getByRole('status').innerText(), /含 3 张图片/)
  await rail('练习').click()
  await page.getByRole('button', { name: '继续练习', exact: true }).click()
  await page.waitForSelector('.media__img', { timeout: 8000 })
  assert.equal(await page.locator('.media--missing').count(), 0, '恢复后图片都能读了')
  assert.equal(await page.locator('.option__pick[aria-pressed="true"]').count(), 1, '含图备份也恢复未提交选项')

  /* 9. 坏图在导入时就被挡下，不会混进题库 */
  await rail('题库').click()
  await page.waitForTimeout(300)
  const brokenPack = buildBrokenPack()
  await page.locator('.dropzone input[type=file]').setInputFiles(brokenPack)
  await page.waitForSelector('.preview', { timeout: 8000 })
  await page.getByRole('button', { name: /^导入 \d+ 题$/ }).click()
  await page.getByRole('alert').filter({ hasText: '解不开' }).waitFor({ timeout: 8000 })
  assert.equal(
    await page.locator('.bankrow').filter({ hasText: '坏图题库' }).count(),
    0,
    '坏图没能进题库',
  )

  assert.deepEqual(errors, [])
  console.log('PASS  图片题：题库包导入、题干与选项配图、放大预览、答题记录、图片选项不误选、完整备份与恢复、缺图拦截、坏图拒收')
} catch (error) {
  console.error(error)
  throw error
} finally {
  await browser.close()
}
