/**
 * 管理员初始化 / 密码重置
 * ---------------------------------------------------------------
 * 用法：
 *   node init-admin.mjs                      创建管理员（已存在则报错退出）
 *   node init-admin.mjs --reset              重置为新的随机密码
 *   node init-admin.mjs --password 'xxx'     指定密码
 *   node init-admin.mjs --username power-admin
 *
 * 密码只在这一步打印一次，之后数据库里只剩 scrypt 哈希，无法取回。
 * 忘记密码就用 --reset 重新生成，不要试图从库里还原。
 */

import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DB_PATH = process.env.DB_PATH || '/var/lib/widget-api/data.db'

// 排除易混淆字符（0/O、1/l/I），便于手工输入
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const PASSWORD_LEN = 20

function randomPassword(len = PASSWORD_LEN) {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

function hashPassword(password) {
  const N = 16384, r = 8, p = 1, keylen = 64
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

// ── 参数解析 ────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name, fallback = '') => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const username = value('--username', 'power-admin')
const reset = flag('--reset')
const explicitPassword = value('--password', '')

if (explicitPassword && explicitPassword.length < 10) {
  console.error('错误：--password 至少 10 位。')
  process.exit(1)
}

// ── 建库 ────────────────────────────────────────────────────────────
mkdirSync(dirname(DB_PATH), { recursive: true })
const db = new DatabaseSync(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip_hash    TEXT
  );
`)

const existing = db.prepare('SELECT * FROM admin WHERE id = 1').get()

if (existing && !reset && !explicitPassword) {
  console.error('管理员已存在，未做任何改动。')
  console.error('如需重置密码，请加 --reset。')
  process.exit(2)
}

const password = explicitPassword || randomPassword()
const now = new Date().toISOString()

if (existing) {
  db.prepare('UPDATE admin SET username = ?, password_hash = ?, updated_at = ? WHERE id = 1')
    .run(username, hashPassword(password), now)
  // 重置密码即吊销全部既有会话
  db.prepare('DELETE FROM sessions').run()
  console.log('已重置管理员密码，并吊销全部登录会话。')
} else {
  db.prepare('INSERT INTO admin (id, username, password_hash, created_at, updated_at) VALUES (1, ?, ?, ?, ?)')
    .run(username, hashPassword(password), now, now)
  console.log('已创建管理员。')
}

console.log('')
console.log('  用户名 : ' + username)
console.log('  密码   : ' + password)
console.log('')
console.log('  ⚠ 此密码只显示这一次，数据库内仅存哈希，无法找回。')
console.log('  ⚠ 请立即登录后台修改为自己的密码。')
console.log('')

db.close()
