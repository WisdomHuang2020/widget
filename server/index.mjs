/**
 * widget 站点留言板 API
 * ---------------------------------------------------------------
 * 设计原则
 *   1. 零第三方依赖：仅用 Node 内置模块（node:http / node:sqlite / node:crypto）。
 *      服务器上不需要 npm install，避免供应链风险与升级负担。
 *   2. 身份校验在服务端：管理员密码以 scrypt 加盐哈希存储，会话令牌只存哈希，
 *      明文令牌仅存在于浏览器 httpOnly Cookie 中。
 *   3. 最小暴露面：只监听 127.0.0.1，由 nginx 反代 /api/。不直接对公网开端口。
 *   4. 不存读者明文 IP：仅存加盐哈希，用于反滥用计数，不可反查。
 *
 * 环境变量
 *   PORT               监听端口            默认 8791
 *   DB_PATH            SQLite 路径         默认 /var/lib/widget-api/data.db
 *   COOKIE_SECURE      1 = Cookie 带 Secure 默认 1（生产必须为 1）
 *   ALLOWED_ORIGINS    允许跨域的来源，逗号分隔（供 GitHub Pages 版调用公开提交接口）
 *   IP_SALT            IP 哈希盐，缺省时随机生成（重启后失效，仅影响反滥用计数）
 */

import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

// ── 配置 ────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 8791)
const DB_PATH = process.env.DB_PATH || '/var/lib/widget-api/data.db'
const COOKIE_SECURE = process.env.COOKIE_SECURE !== '0'
const API_VERSION = '1.0.0'

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000   // 会话 7 天
const SESSION_COOKIE = 'wid_sess'

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://wisdomhuang2020.github.io')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// 缺省随机盐：仅用于 IP 计数哈希，重启后旧计数失效，可接受
const IP_SALT = process.env.IP_SALT || randomBytes(16).toString('hex')

// 字段长度上限
const LIMITS = {
  page: 64,
  content: 4000,
  contentMin: 10,
  contact: 200,
  username: 64,
  password: 200,
  passwordMin: 10,
}

// ── 附件（2026-11-02 新增）──────────────────────────────────────────────────
/**
 * 与站群统一服务（entrance/server/feedback-api）同一套规则，但本站是单站版，
 * 表里不需要 site 列。两套实现并存是历史原因（本站先有留言板，五站后接入
 * 统一服务），协议与安全模型保持一致，前端代码可以互抄。
 *
 * 为什么落盘不进库：SQLite 存 blob 会让单条留言的读写放大到 MB 级，
 * 而文件只在管理员点开时读一次。
 * 为什么 base64 而非 multipart：Node 内置模块没有 multipart 解析器，
 * 手写边界解析是高风险低收益代码。
 * 为什么禁 SVG：SVG 是 XML，可内联 <script>。
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/lib/widget-api/uploads'
const ATTACH = {
  maxFiles: 3,
  maxBytes: 2 * 1024 * 1024,
  maxTotalBytes: 6 * 1024 * 1024,
  allow: {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/csv': 'csv',
  },
}

/** 魔数校验：mime 由客户端自报，必须用文件头复核，否则改个后缀就能混进来。 */
function sniffOk(mime, buf) {
  const b = (i) => buf[i]
  switch (mime) {
    case 'image/png':
      return b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47
    case 'image/jpeg':
      return b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff
    case 'image/gif':
      return b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38
    case 'image/webp':
      return buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP'
    case 'application/pdf':
      return buf.slice(0, 4).toString('latin1') === '%PDF'
    case 'text/plain':
    case 'text/csv': {
      if (buf.includes(0)) return false
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, 4096))
        return true
      } catch {
        return false
      }
    }
    default:
      return false
  }
}

// ── 通用工具 ────────────────────────────────────────────────────────
const sha256 = (s) => createHash('sha256').update(s).digest('hex')

function ipHash(ip) {
  return sha256(IP_SALT + '|' + ip).slice(0, 32)
}

function clientIp(req) {
  // nginx 已设置 X-Real-IP；直连兜底用 socket
  const xr = req.headers['x-real-ip']
  if (typeof xr === 'string' && xr) return xr.trim()
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (!k) continue
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

function sendJson(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  res.end(body)
}

function readJson(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) {
        reject(Object.assign(new Error('payload too large'), { code: 'TOO_LARGE' }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('invalid json'), { code: 'BAD_JSON' }))
      }
    })
    req.on('error', reject)
  })
}

function str(v, max) {
  if (typeof v !== 'string') return ''
  return v.trim().slice(0, max)
}

// ── 滑动窗口限流（进程内存，重启即清零） ─────────────────────────────
const buckets = new Map()

function rateLimit(key, max, windowMs) {
  const now = Date.now()
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs)
  if (arr.length >= max) {
    buckets.set(key, arr)
    return false
  }
  arr.push(now)
  buckets.set(key, arr)
  return true
}

// 每 10 分钟清理一次过期桶，避免长期运行内存增长
setInterval(() => {
  const now = Date.now()
  const LONGEST = 24 * 3600 * 1000
  for (const [k, arr] of buckets) {
    const kept = arr.filter((t) => now - t < LONGEST)
    if (kept.length) buckets.set(k, kept)
    else buckets.delete(k)
  }
}, 10 * 60 * 1000).unref()

// ── 密码哈希（scrypt，参数内置于哈希串，便于日后升级） ────────────────
function hashPassword(password) {
  const N = 16384
  const r = 8
  const p = 1
  const keylen = 64
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

function verifyPassword(password, stored) {
  try {
    const [algo, Ns, rs, ps, saltB64, hashB64] = stored.split('$')
    if (algo !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(Ns),
      r: Number(rs),
      p: Number(ps),
      maxmem: 64 * 1024 * 1024,
    })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// 用户不存在时也比对一次，抹掉时间差，避免用户名枚举
const DUMMY_HASH = hashPassword(randomBytes(24).toString('base64'))

// ── 数据库 ──────────────────────────────────────────────────────────
mkdirSync(dirname(DB_PATH), { recursive: true })
mkdirSync(UPLOAD_DIR, { recursive: true })
const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

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

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    page       TEXT NOT NULL,
    content    TEXT NOT NULL,
    contact    TEXT,
    status     TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    ip_hash    TEXT,
    ua_hash    TEXT
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id  INTEGER NOT NULL,
    orig_name   TEXT NOT NULL,
    mime        TEXT NOT NULL,
    size        INTEGER NOT NULL,
    stored_name TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_att_msg ON attachments(message_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_status  ON messages(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`)

const nowIso = () => new Date().toISOString()

// ── 附件读写 ────────────────────────────────────────────────────────────────
/** 任一项不合规就整批拒绝，不写部分文件：半个附件比没有附件更让人困惑。 */
function saveAttachments(messageId, files) {
  if (!Array.isArray(files) || files.length === 0) return { saved: [] }
  if (files.length > ATTACH.maxFiles) return { error: `最多 ${ATTACH.maxFiles} 个附件。` }

  const prepared = []
  let total = 0
  for (const f of files) {
    const name = typeof f?.name === 'string' ? f.name.slice(0, 120) : 'file'
    const mime = typeof f?.mime === 'string' ? f.mime.toLowerCase() : ''
    const ext = ATTACH.allow[mime]
    if (!ext) {
      return { error: `不支持的文件类型：${mime || '未知'}。仅允许 PNG / JPEG / WebP / GIF / PDF / TXT / CSV。` }
    }
    const b64 = typeof f?.data === 'string' ? f.data : ''
    if (b64.length > Math.ceil((ATTACH.maxBytes * 4) / 3) + 16) {
      return { error: `单个附件不能超过 ${ATTACH.maxBytes / 1024 / 1024} MB。` }
    }
    let buf
    try {
      buf = Buffer.from(b64, 'base64')
    } catch {
      return { error: '附件编码无效。' }
    }
    if (buf.length === 0) return { error: '附件内容为空。' }
    if (buf.length > ATTACH.maxBytes) {
      return { error: `单个附件不能超过 ${ATTACH.maxBytes / 1024 / 1024} MB。` }
    }
    total += buf.length
    if (total > ATTACH.maxTotalBytes) {
      return { error: `附件合计不能超过 ${ATTACH.maxTotalBytes / 1024 / 1024} MB。` }
    }
    if (!sniffOk(mime, buf)) return { error: `文件内容与类型不符：${name}` }
    prepared.push({ name, mime, ext, buf })
  }

  const saved = []
  for (const p of prepared) {
    // 存储名完全由服务端生成；原始文件名只进库用于显示，绝不参与拼路径
    const stored = `${randomBytes(16).toString('hex')}.${p.ext}`
    writeFileSync(join(UPLOAD_DIR, stored), p.buf)
    db.prepare(`
      INSERT INTO attachments (message_id, orig_name, mime, size, stored_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(messageId, p.name, p.mime, p.buf.length, stored, nowIso())
    saved.push({ name: p.name, mime: p.mime, size: p.buf.length })
  }
  return { saved }
}

function listAttachments(messageId) {
  return db
    .prepare('SELECT id, orig_name AS name, mime, size FROM attachments WHERE message_id = ?')
    .all(messageId)
}

/** 删留言时一并删文件，否则磁盘只增不减（这里没有回收站）。 */
function deleteAttachmentsOf(messageId) {
  const rows = db.prepare('SELECT stored_name FROM attachments WHERE message_id = ?').all(messageId)
  for (const r of rows) {
    const f = join(UPLOAD_DIR, r.stored_name)
    try {
      if (existsSync(f)) unlinkSync(f)
    } catch {}
  }
  db.prepare('DELETE FROM attachments WHERE message_id = ?').run(messageId)
}

function getAdmin() {
  return db.prepare('SELECT * FROM admin WHERE id = 1').get()
}

function createSession(ip) {
  const token = randomBytes(32).toString('base64url')
  const created = new Date()
  const expires = new Date(created.getTime() + SESSION_TTL_MS)
  db.prepare('INSERT INTO sessions (token_hash, created_at, expires_at, ip_hash) VALUES (?, ?, ?, ?)')
    .run(sha256(token), created.toISOString(), expires.toISOString(), ipHash(ip))
  return { token, expires }
}

function readSession(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  if (!token) return null
  const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(token))
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash)
    return null
  }
  return row
}

function sessionCookie(token, expires) {
  const maxAge = Math.floor((expires.getTime() - Date.now()) / 1000)
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ]
  if (COOKIE_SECURE) parts.push('Secure')
  return parts.join('; ')
}

function clearCookie() {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0']
  if (COOKIE_SECURE) parts.push('Secure')
  return parts.join('; ')
}

// ── CORS（仅对公开提交接口开放） ────────────────────────────────────
function corsHeaders(req) {
  const origin = req.headers.origin
  if (!origin) return {}
  if (!ALLOWED_ORIGINS.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

// 管理接口只允许同源调用，校验 Origin 防止 CSRF
function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true // 同源的非浏览器客户端（curl）不带 Origin
  try {
    return new URL(origin).host === (req.headers.host || '')
  } catch {
    return false
  }
}

// ── 路由 ────────────────────────────────────────────────────────────
const routes = []

function route(method, pattern, handler) {
  const re = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, '([^/]+)') + '$')
  routes.push({ method, re, handler })
}

route('GET', '/api/health', async (req, res) => {
  const admin = getAdmin()
  sendJson(res, 200, {
    ok: true,
    version: API_VERSION,
    adminConfigured: Boolean(admin),
    originAllowed: ALLOWED_ORIGINS,
  })
})

// —— 公开：提交反馈 ——
route('POST', '/api/feedback', async (req, res, ctx) => {
  const ip = ctx.ip

  // 每 IP：10 分钟 5 条，24 小时 20 条
  if (!rateLimit(`fb:10m:${ip}`, 5, 10 * 60 * 1000) ||
      !rateLimit(`fb:24h:${ip}`, 20, 24 * 3600 * 1000)) {
    sendJson(res, 429, { error: '提交过于频繁，请稍后再试。' }, corsHeaders(req))
    return
  }

  // 正文 4000 字 + 附件 6MB，base64 后约 8MB；给到 12MB 免得卡边界
  const body = await readJson(req, 12 * 1024 * 1024)
  const page = str(body.page, LIMITS.page) || '未指定'
  const content = str(body.content, LIMITS.content)
  const contact = str(body.contact, LIMITS.contact)

  // 蜜罐字段：正常用户看不见，填了即为机器人。静默接受但不落库。
  if (str(body.website, 200)) {
    sendJson(res, 201, { ok: true }, corsHeaders(req))
    return
  }

  if (content.length < LIMITS.contentMin) {
    sendJson(res, 400, { error: `问题描述至少 ${LIMITS.contentMin} 个字。` }, corsHeaders(req))
    return
  }

  const uaHash = sha256(String(req.headers['user-agent'] || '')).slice(0, 16)
  const r = db
    .prepare('INSERT INTO messages (page, content, contact, status, created_at, ip_hash, ua_hash) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(page, content, contact || null, 'new', nowIso(), ipHash(ip), uaHash)

  const messageId = Number(r.lastInsertRowid)

  // 附件失败就回滚这条留言：宁可让读者重填，也不要留一条"正文到了、图没到"的记录
  const att = saveAttachments(messageId, body.files)
  if (att.error) {
    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId)
    sendJson(res, 400, { error: att.error }, corsHeaders(req))
    return
  }

  console.log(`[feedback] 新增 #${messageId} page=${page} len=${content.length} files=${att.saved.length}`)
  sendJson(res, 201, { ok: true, attachments: att.saved.length }, corsHeaders(req))
})

// —— 管理：登录 ——
route('POST', '/api/admin/login', async (req, res, ctx) => {
  if (!sameOrigin(req)) return sendJson(res, 403, { error: '来源不被允许。' })
  if (!rateLimit(`login:${ctx.ip}`, 8, 15 * 60 * 1000)) {
    return sendJson(res, 429, { error: '尝试次数过多，请 15 分钟后再试。' })
  }

  const body = await readJson(req)
  const username = str(body.username, LIMITS.username)
  const password = typeof body.password === 'string' ? body.password.slice(0, LIMITS.password) : ''

  const admin = getAdmin()
  if (!admin) return sendJson(res, 503, { error: '管理员尚未初始化。' })

  const userOk = username === admin.username
  const passOk = verifyPassword(password || '', userOk ? admin.password_hash : DUMMY_HASH)

  if (!userOk || !passOk) {
    console.warn(`[login] 失败 ip=${ipHash(ctx.ip)} user=${username}`)
    return sendJson(res, 401, { error: '用户名或密码错误。' })
  }

  const { token, expires } = createSession(ctx.ip)
  console.log(`[login] 成功 user=${username}`)
  sendJson(res, 200, { ok: true, username }, { 'Set-Cookie': sessionCookie(token, expires) })
})

// —— 管理：登出 ——
route('POST', '/api/admin/logout', async (req, res) => {
  if (!sameOrigin(req)) return sendJson(res, 403, { error: '来源不被允许。' })
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() })
})

// —— 管理：当前身份 ——
route('GET', '/api/admin/me', async (req, res) => {
  const sess = readSession(req)
  if (!sess) return sendJson(res, 401, { error: '未登录。' })
  sendJson(res, 200, { username: getAdmin()?.username || '', expiresAt: sess.expires_at })
})

// —— 管理：留言列表 ——
route('GET', '/api/admin/messages', async (req, res, ctx) => {
  if (!readSession(req)) return sendJson(res, 401, { error: '未登录。' })

  const url = new URL(req.url, 'http://x')
  const status = url.searchParams.get('status') || ''
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  const where = status === 'new' || status === 'read' || status === 'archived' ? 'WHERE status = ?' : ''
  const args = where ? [status] : []

  const items = db
    .prepare(`SELECT id, page, content, contact, status, created_at FROM messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, offset)

  // 附件随列表一起返回：后台要显示"有几张图"，分页拉取会让列表闪烁
  for (const it of items) it.attachments = listAttachments(it.id)

  const total = db.prepare(`SELECT COUNT(*) AS c FROM messages ${where}`).get(...args).c

  const counts = { all: 0, new: 0, read: 0, archived: 0 }
  for (const row of db.prepare('SELECT status, COUNT(*) AS c FROM messages GROUP BY status').all()) {
    counts[row.status] = Number(row.c)
    counts.all += Number(row.c)
  }

  sendJson(res, 200, { items, total: Number(total), counts })
})

// —— 管理：改状态 ——
route('PATCH', '/api/admin/messages/:id', async (req, res) => {
  if (!sameOrigin(req)) return sendJson(res, 403, { error: '来源不被允许。' })
  if (!readSession(req)) return sendJson(res, 401, { error: '未登录。' })

  const id = Number(req.url.split('/').pop())
  if (!Number.isInteger(id)) return sendJson(res, 400, { error: 'id 无效。' })

  const body = await readJson(req)
  const status = str(body.status, 16)
  if (!['new', 'read', 'archived'].includes(status)) {
    return sendJson(res, 400, { error: 'status 无效。' })
  }
  const r = db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, id)
  if (!r.changes) return sendJson(res, 404, { error: '留言不存在。' })
  sendJson(res, 200, { ok: true })
})

// —— 管理：删除 ——
route('DELETE', '/api/admin/messages/:id', async (req, res) => {
  if (!sameOrigin(req)) return sendJson(res, 403, { error: '来源不被允许。' })
  if (!readSession(req)) return sendJson(res, 401, { error: '未登录。' })

  const id = Number(req.url.split('/').pop())
  if (!Number.isInteger(id)) return sendJson(res, 400, { error: 'id 无效。' })

  const r = db.prepare('DELETE FROM messages WHERE id = ?').run(id)
  if (!r.changes) return sendJson(res, 404, { error: '留言不存在。' })
  // 先删留言再删文件：即使删文件抛错，库里也不会留指向空文件的孤儿记录
  deleteAttachmentsOf(id)
  sendJson(res, 200, { ok: true })
})

// —— 管理：下载附件 ——
/**
 * 必须带管理员会话才能下：留言对作者以外所有人不可见，附件里往往是电路照片、
 * 客户截图，泄露一条等于泄露整条留言。
 * Content-Type 一律 octet-stream + attachment：就算传的是 png 也不让浏览器内联渲染，
 * 这是存储型 XSS 的常见入口，直接掐掉。
 */
route('GET', '/api/admin/attachments/:id', async (req, res) => {
  if (!readSession(req)) return sendJson(res, 401, { error: '未登录。' })

  const id = Number(req.url.split('?')[0].split('/').pop())
  if (!Number.isInteger(id)) return sendJson(res, 400, { error: 'id 无效。' })

  const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id)
  if (!row) return sendJson(res, 404, { error: '附件不存在。' })

  let buf
  try {
    buf = readFileSync(join(UPLOAD_DIR, row.stored_name))
  } catch {
    return sendJson(res, 404, { error: '附件文件已丢失（可能被手工清理过）。' })
  }

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': buf.length,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.orig_name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  })
  res.end(buf)
})

// —— 管理：改密码 ——
route('POST', '/api/admin/password', async (req, res) => {
  if (!sameOrigin(req)) return sendJson(res, 403, { error: '来源不被允许。' })
  const sess = readSession(req)
  if (!sess) return sendJson(res, 401, { error: '未登录。' })

  const body = await readJson(req)
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const next = typeof body.newPassword === 'string' ? body.newPassword.slice(0, LIMITS.password) : ''

  const admin = getAdmin()
  if (!admin || !verifyPassword(current, admin.password_hash)) {
    return sendJson(res, 401, { error: '当前密码不正确。' })
  }
  if (next.length < LIMITS.passwordMin) {
    return sendJson(res, 400, { error: `新密码至少 ${LIMITS.passwordMin} 位。` })
  }
  if (next === current) {
    return sendJson(res, 400, { error: '新密码不能与当前密码相同。' })
  }

  db.prepare('UPDATE admin SET password_hash = ?, updated_at = ? WHERE id = 1')
    .run(hashPassword(next), nowIso())

  // 改密后吊销其它会话，只保留当前这一个
  db.prepare('DELETE FROM sessions WHERE token_hash <> ?').run(sess.token_hash)

  console.log('[password] 管理员密码已更新')
  sendJson(res, 200, { ok: true })
})

// ── HTTP 服务 ───────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const started = Date.now()
  const url = (req.url || '/').split('?')[0]
  const ip = clientIp(req)

  // 预检
  if (req.method === 'OPTIONS' && url.startsWith('/api/')) {
    res.writeHead(204, corsHeaders(req))
    res.end()
    return
  }

  try {
    for (const r of routes) {
      if (r.method !== req.method) continue
      if (!r.re.test(url)) continue
      await r.handler(req, res, { ip })
      return
    }

    // 落到这里说明未匹配
    if (url.startsWith('/api/')) {
      sendJson(res, 404, { error: '接口不存在。' })
    } else {
      sendJson(res, 404, { error: 'not found' })
    }
  } catch (err) {
    if (err?.code === 'TOO_LARGE') return sendJson(res, 413, { error: '内容过长。' })
    if (err?.code === 'BAD_JSON') return sendJson(res, 400, { error: '请求体不是合法 JSON。' })
    console.error('[error]', err)
    if (!res.headersSent) sendJson(res, 500, { error: '服务器内部错误。' })
  } finally {
    const ms = Date.now() - started
    if (url.startsWith('/api/')) {
      console.log(`${req.method} ${url} ${res.statusCode} ${ms}ms`)
    }
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`widget-api v${API_VERSION} listening on 127.0.0.1:${PORT}`)
  console.log(`db: ${DB_PATH}`)
  console.log(`admin configured: ${Boolean(getAdmin())}`)
})

// 优雅退出
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`收到 ${sig}，正在关闭…`)
    server.close(() => {
      try { db.close() } catch {}
      process.exit(0)
    })
  })
}
