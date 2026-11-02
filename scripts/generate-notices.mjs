import fs from 'node:fs/promises'
import path from 'node:path'

const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'))
const sections = []
for (const [location, metadata] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!location || metadata.dev) continue
  const directory = path.resolve(location)
  let pkg
  try { pkg = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8')) }
  catch { throw new Error(`Dependency missing: ${location}. Run npm ci first.`) }
  const files = (await fs.readdir(directory)).filter(name => /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(name))
  const texts = []
  for (const name of files.sort()) {
    const file = path.join(directory, name)
    if ((await fs.stat(file)).isFile()) texts.push(`### ${name}\n\n${await fs.readFile(file, 'utf8')}`)
  }
  sections.push(`## ${pkg.name} ${pkg.version}\n\nLicense: ${typeof pkg.license === 'string' ? pkg.license : 'See upstream package'}\nSource: https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}\n\n${texts.join('\n\n') || 'No top-level license file shipped in this package; consult the source link.'}`)
}
const header = '# Third-Party Notices\n\nGenerated from package-lock.json. Includes installed production npm dependencies and their bundled license/notice files. Development tools, Rust dependencies, fonts and the Bun runtime are tracked separately in docs/open-source.md.\n\n'
await fs.writeFile('THIRD_PARTY_NOTICES.md', header + sections.join('\n\n---\n\n') + '\n')
console.log(`Generated notices for ${sections.length} production packages`)
