/**
 * 版本号单一来源门禁
 *
 * 目的：防止版本号在多个显示点各写一份、各自漂移（真实踩过的坑：页头徽标与页脚
 * 同时硬编码 v1.0.0，而实际已迭代到 v2.x，页面显示与实际版本各说各话）。
 *
 * 本站做法：唯一来源是 package.json 的 version，经 vite.config.ts 的 define
 * 注入为全局常量 __APP_VERSION__，页头与页脚都渲染这同一个常量。
 * 本脚本把这条约定写成可执行的断言。
 *
 * 用法：node scripts/verify-version.mjs   （或 npm run verify:version）
 * 退出码：0 = 全部通过；1 = 存在违规
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rel = (p) => path.relative(root, p).replace(/\\/g, '/')

let failures = 0
const check = (cond, label, detail = '') => {
  if (cond) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── 1. 唯一来源：package.json 的 version ──
console.log('\n[1] 版本号唯一来源')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const SEMVER = /^\d+\.\d+\.\d+$/
check(SEMVER.test(pkg.version), `package.json version 格式合法（当前 ${pkg.version}）`)
const EXPECTED = `v${pkg.version}`

// ── 2. vite 注入链路存在 ──
const viteConf = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8')
check(
  /__APP_VERSION__/.test(viteConf) && /pkg\.version/.test(viteConf),
  'vite.config.ts 把 package.json 的 version 注入为 __APP_VERSION__',
)

// ── 3. 收集源码 ──
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}
const srcFiles = walk(path.join(root, 'src')).filter((f) => /\.(tsx?|css)$/.test(f))

// ── 4. 不得出现硬编码版本号 ──
console.log('\n[2] 无硬编码版本号')
const HARDCODED = /v\d+\.\d+\.\d+/g

const htmlPath = path.join(root, 'index.html')
const htmlHits = fs.readFileSync(htmlPath, 'utf8').match(HARDCODED) || []
check(htmlHits.length === 0, `${rel(htmlPath)} 无 vX.Y.Z 字面量`, htmlHits.join(', '))

const srcHits = []
for (const f of srcFiles) {
  const hits = fs.readFileSync(f, 'utf8').match(HARDCODED) || []
  if (hits.length) srcHits.push(`${rel(f)} → ${hits.join(', ')}`)
}
check(srcHits.length === 0, 'src/ 下无 vX.Y.Z 字面量', srcHits.join(' | '))

// ── 5. 渲染点齐全且都走同一常量 ──
console.log('\n[3] 渲染点')
let hookCount = 0
let constRefCount = 0
const detail = []
for (const f of srcFiles) {
  const s = fs.readFileSync(f, 'utf8')
  const hooks = (s.match(/className="[^"]*\bapp-version\b[^"]*"/g) || []).length
  // 只统计 JSX 插值形式 {__APP_VERSION__}：注释里对常量名的提及不应计入渲染点
  const consts = (s.match(/\{__APP_VERSION__\}/g) || []).length
  if (hooks || consts) detail.push(`${rel(f)}: 钩子×${hooks} 常量×${consts}`)
  hookCount += hooks
  constRefCount += consts
}
check(hookCount >= 2, `版本号显示点 ≥ 2 处（实际 ${hookCount} 处）`, detail.join('; '))
check(
  constRefCount >= 2 && constRefCount === hookCount,
  `每个显示点都引用 __APP_VERSION__（常量 ${constRefCount} 次 / 钩子 ${hookCount} 处）`,
)

// ── 汇总 ──
console.log('')
if (failures === 0) {
  console.log(`✅ 版本号单一来源校验通过（当前 ${EXPECTED}）。`)
  process.exit(0)
} else {
  console.log(`❌ 存在 ${failures} 处违规。`)
  process.exit(1)
}
