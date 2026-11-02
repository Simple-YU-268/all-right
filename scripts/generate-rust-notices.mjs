import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { zipSync } from 'fflate'
/* --offline 而非 --locked：版本号变动时锁文件需要更新，但不允许联网改依赖版本。 */
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--manifest-path', 'src-tauri/Cargo.toml', '--format-version', '1', '--offline'], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 }))
const sections = []
const sources = {}
for (const pkg of metadata.packages.filter(p => p.source).sort((a,b) => a.name.localeCompare(b.name))) {
  const dir = path.dirname(pkg.manifest_path)
  const files = (await fs.readdir(dir)).filter(name => /^(license|licence|notice|copying)(\.|-|$)/i.test(name))
  const texts = []
  for (const file of files) if ((await fs.stat(path.join(dir,file))).isFile()) texts.push(`### ${file}\n\n${await fs.readFile(path.join(dir,file), 'utf8')}`)
  if (!pkg.license) throw new Error(`Missing license metadata: ${pkg.name}`)
  if (!texts.length || pkg.license.includes('MPL')) {
    async function collect(directory, prefix) {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name)
        const name = `${prefix}/${entry.name}`
        if (entry.isDirectory()) await collect(full, name)
        else if (entry.isFile()) sources[name] = new Uint8Array(await fs.readFile(full))
      }
    }
    await collect(dir, `${pkg.name}-${pkg.version}`)
  }
  sections.push(`## ${pkg.name} ${pkg.version}\n\nLicense expression: ${pkg.license}\nSource: https://crates.io/crates/${pkg.name}/${pkg.version}\n\n${texts.join('\n\n') || 'License text is not present at package root; refer to the source package.'}`)
}
await fs.writeFile('RUST_THIRD_PARTY_NOTICES.md', '# Rust Third-Party Notices\n\nConservative inventory of all locked platforms and build dependencies, not just linked Windows code.\n\n' + sections.join('\n\n---\n\n'))
await fs.copyFile('RUST_THIRD_PARTY_NOTICES.md', 'src-tauri/resources/RUST_THIRD_PARTY_NOTICES.md')
console.log(`Rust notices: ${sections.length} packages`)
await fs.mkdir('src-tauri/resources', { recursive: true })
await fs.writeFile('src-tauri/resources/rust-source-supplement.zip', zipSync(sources))
