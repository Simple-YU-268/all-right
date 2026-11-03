/* 从 Zod 定义生成 JSON Schema 产物：前端只拿 JSON，不用把 Zod 打进界面包。 */
import { writeFile } from 'node:fs/promises'
import { loadAppModule } from './lib/load-app-module.mjs'

const { BANK_JSON_SCHEMA } = await loadAppModule('src/domain/bankSchema.ts')
await writeFile('src/domain/bankSchema.json', JSON.stringify(BANK_JSON_SCHEMA, null, 2) + '\n')
console.log('Generated src/domain/bankSchema.json')
