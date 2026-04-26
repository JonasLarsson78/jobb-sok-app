#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')

const version = process.argv[2]

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: npm run new:version <version>  (e.g. 1.0.0)')
  process.exit(1)
}

function updateJSON(file, updater) {
  const path = resolve(root, file)
  const json = JSON.parse(readFileSync(path, 'utf8'))
  updater(json)
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n')
  console.log(`✓ ${file}  →  ${version}`)
}

function updateToml(file, key) {
  const path = resolve(root, file)
  let content = readFileSync(path, 'utf8')
  content = content.replace(
    new RegExp(`^(${key}\\s*=\\s*)"[^"]+"`, 'm'),
    `$1"${version}"`
  )
  writeFileSync(path, content)
  console.log(`✓ ${file}  →  ${version}`)
}

updateJSON('package.json', j => { j.version = version })
updateJSON('src-tauri/tauri.conf.json', j => { j.version = version })
updateToml('src-tauri/Cargo.toml', 'version')

// Regenerera package-lock.json
execSync('npm install --package-lock-only', { cwd: root, stdio: 'inherit' })
console.log(`✓ package-lock.json regenererad`)

// Commit + tag + push
execSync('git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml', { cwd: root, stdio: 'inherit' })
const status = execSync('git status --porcelain', { cwd: root }).toString().trim()
if (status) {
  execSync(`git commit -m "chore: bump version to ${version}"`, { cwd: root, stdio: 'inherit' })
} else {
  console.log('✓ Inga filändringar att committa')
}

// Ta bort befintlig tagg om den finns
try {
  execSync(`git tag -d v${version}`, { cwd: root, stdio: 'pipe' })
  execSync(`git push origin --delete v${version}`, { cwd: root, stdio: 'pipe' })
} catch { /* taggen fanns inte */ }

execSync(`git tag v${version}`, { cwd: root, stdio: 'inherit' })
execSync('git push', { cwd: root, stdio: 'inherit' })
execSync(`git push origin v${version}`, { cwd: root, stdio: 'inherit' })

console.log(`\n✓ Version ${version} taggad och pushad → GitHub Actions startar bygget`)
