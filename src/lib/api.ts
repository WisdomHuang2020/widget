/**
 * 留言板 API 客户端
 * ---------------------------------------------------------------
 * 三处部署形态共用同一份前端产物，API 基址按 hostname 分流：
 *
 *   自有域名（www.widget.power-knowledge.tech / 别名）  → 同源 ''，nginx 反代 /api/
 *   本地开发（localhost / 127.0.0.1）                  → 同源 ''，由 vite server.proxy 转 127.0.0.1:8791
 *   GitHub Pages（*.github.io）                        → 绝对地址，跨域调用正式站公开接口
 *
 * 注意：GitHub Pages 版只能「提交」反馈，不能进后台 —— 因为管理会话是
 * SameSite=Strict 的 Cookie，跨站不会被发送。这是刻意的：后台只允许在正式域名操作。
 */

const PRODUCTION_ORIGIN = 'https://www.widget.power-knowledge.tech'

export function apiBase(): string {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname
  if (host.endsWith('.github.io')) return PRODUCTION_ORIGIN
  return ''
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { withCredentials = false }: { withCredentials?: boolean } = {},
): Promise<T> {
  const res = await fetch(apiBase() + path, {
    ...init,
    credentials: withCredentials ? 'include' : 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })

  let payload: unknown = null
  const text = await res.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!res.ok) {
    let message = `请求失败（HTTP ${res.status}）`
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const raw = (payload as { error: unknown }).error
      if (typeof raw === 'string' && raw) message = raw
    }
    throw new ApiError(message, res.status)
  }

  return payload as T
}

// ── 公开接口 ────────────────────────────────────────────────────────
/** 附件以 base64 随 JSON 提交：单文件 2MB、最多 3 个，后端按魔数复核类型。 */
export interface AttachmentInput {
  name: string
  mime: string
  data: string
}

export interface FeedbackPayload {
  page: string
  content: string
  contact?: string
  /** 蜜罐字段，正常用户不填；前端固定留空 */
  website?: string
  files?: AttachmentInput[]
}

/** 读取 File 为 base64（去掉 dataURL 前缀）。 */
export function fileToPayload(f: File): Promise<AttachmentInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      const comma = url.indexOf(',')
      resolve({
        name: f.name,
        mime: f.type || 'application/octet-stream',
        data: comma >= 0 ? url.slice(comma + 1) : '',
      })
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(f)
  })
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  await request<{ ok: true }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ── 管理接口 ────────────────────────────────────────────────────────
export type MessageStatus = 'new' | 'read' | 'archived'

export interface Attachment {
  id: number
  name: string
  mime: string
  size: number
}

export interface AdminMessage {
  id: number
  page: string
  content: string
  contact: string | null
  status: MessageStatus
  created_at: string
  attachments?: Attachment[]
}

export interface MessageListResult {
  items: AdminMessage[]
  total: number
  counts: { all: number; new: number; read: number; archived: number }
}

export async function adminLogin(username: string, password: string): Promise<{ username: string }> {
  return request<{ ok: true; username: string }>(
    '/api/admin/login',
    { method: 'POST', body: JSON.stringify({ username, password }) },
    { withCredentials: true },
  )
}

export async function adminLogout(): Promise<void> {
  await request('/api/admin/logout', { method: 'POST' }, { withCredentials: true })
}

export async function adminMe(): Promise<{ username: string }> {
  return request<{ username: string }>('/api/admin/me', {}, { withCredentials: true })
}

export async function listMessages(
  status: MessageStatus | 'all',
  limit = 50,
  offset = 0,
): Promise<MessageListResult> {
  const qs = new URLSearchParams()
  if (status !== 'all') qs.set('status', status)
  qs.set('limit', String(limit))
  qs.set('offset', String(offset))
  return request<MessageListResult>(`/api/admin/messages?${qs}`, {}, { withCredentials: true })
}

export async function updateMessageStatus(id: number, status: MessageStatus): Promise<void> {
  await request(
    `/api/admin/messages/${id}`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    { withCredentials: true },
  )
}

export async function deleteMessage(id: number): Promise<void> {
  await request(`/api/admin/messages/${id}`, { method: 'DELETE' }, { withCredentials: true })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request(
    '/api/admin/password',
    { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) },
    { withCredentials: true },
  )
}
