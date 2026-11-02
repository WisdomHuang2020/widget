import { useState, useEffect, useCallback, type FormEvent } from 'react'
import {
  LogIn,
  LogOut,
  RefreshCw,
  Trash2,
  MailOpen,
  Archive,
  KeyRound,
  Loader2,
  AlertTriangle,
  Inbox,
  ShieldAlert,
  Mail,
  MailCheck,
  Settings,
  X,
} from 'lucide-react'
import {
  adminLogin,
  adminLogout,
  adminMe,
  listMessages,
  updateMessageStatus,
  deleteMessage,
  changePassword,
  ApiError,
  type AdminMessage,
  type MessageStatus,
} from '../lib/api'

type AuthState = 'checking' | 'out' | 'in'
type Filter = 'all' | MessageStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'new', label: '未读' },
  { key: 'read', label: '已读' },
  { key: 'archived', label: '已归档' },
]

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 后台只能在正式域名使用：管理会话是 SameSite=Strict Cookie，GitHub Pages 跨站发不出去。 */
function isCrossOriginDeployment(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')
}

export default function Admin() {
  const [auth, setAuth] = useState<AuthState>('checking')
  const [username, setUsername] = useState('')

  // 登录表单
  const [inputUser, setInputUser] = useState('power-admin')
  const [inputPass, setInputPass] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState('')

  // 留言列表
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<AdminMessage[]>([])
  const [counts, setCounts] = useState({ all: 0, new: 0, read: 0, archived: 0 })
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  // 改密码（收纳在「设置」弹层内，不再常驻列表下方）
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const crossOrigin = isCrossOriginDeployment()

  // 启动时探测会话
  useEffect(() => {
    if (crossOrigin) {
      setAuth('out')
      return
    }
    let alive = true
    adminMe()
      .then((r) => {
        if (!alive) return
        setUsername(r.username)
        setAuth('in')
      })
      .catch(() => {
        if (alive) setAuth('out')
      })
    return () => {
      alive = false
    }
  }, [crossOrigin])

  const load = useCallback(
    async (f: Filter) => {
      if (crossOrigin) return
      setLoading(true)
      setListError('')
      try {
        const r = await listMessages(f, 200, 0)
        setItems(r.items)
        setCounts(r.counts)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuth('out')
          return
        }
        setListError(err instanceof ApiError ? err.message : '加载失败，请检查网络。')
      } finally {
        setLoading(false)
      }
    },
    [crossOrigin],
  )

  useEffect(() => {
    if (auth === 'in') void load(filter)
  }, [auth, filter, load])

  // 设置弹层：Esc 关闭
  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen])

  function closeSettings() {
    setSettingsOpen(false)
    setPwMsg(null)
    setCurPass('')
    setNewPass('')
    setConfirmPass('')
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoggingIn(true)
    try {
      const r = await adminLogin(inputUser.trim(), inputPass)
      setUsername(r.username)
      setInputPass('')
      setAuth('in')
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : '网络异常，登录未成功。')
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleLogout() {
    try {
      await adminLogout()
    } catch {
      // 登出失败也照常回到登录页
    }
    setAuth('out')
    setItems([])
    setFilter('all')
    setSettingsOpen(false)
  }

  async function handleStatus(id: number, status: MessageStatus) {
    setBusyId(id)
    try {
      await updateMessageStatus(id, status)
      await load(filter)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setAuth('out')
      else setListError(err instanceof ApiError ? err.message : '操作失败。')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('确定删除这条留言？删除后无法恢复。')) return
    setBusyId(id)
    try {
      await deleteMessage(id)
      await load(filter)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setAuth('out')
      else setListError(err instanceof ApiError ? err.message : '删除失败。')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (newPass !== confirmPass) {
      setPwMsg({ type: 'err', text: '两次输入的新密码不一致。' })
      return
    }
    setPwBusy(true)
    try {
      await changePassword(curPass, newPass)
      setPwMsg({ type: 'ok', text: '密码已更新。其它设备的登录已全部失效。' })
      setCurPass('')
      setNewPass('')
      setConfirmPass('')
    } catch (err) {
      setPwMsg({ type: 'err', text: err instanceof ApiError ? err.message : '修改失败。' })
    } finally {
      setPwBusy(false)
    }
  }

  // ── 探测中 ──
  if (auth === 'checking') {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
        <p className="text-sm">正在检查登录状态…</p>
      </div>
    )
  }

  // ── 登录页 ──
  if (auth === 'out') {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="card-surface p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-1">
            <ShieldAlert className="w-5 h-5 text-primary-light" />
            <h1 className="text-lg font-semibold text-text-primary">后台登录</h1>
          </div>
          <p className="text-xs text-text-muted mb-6">仅作者本人可查看读者留言。</p>

          {crossOrigin && (
            <div className="mb-5 p-3 rounded-md bg-accent/10 border border-accent/30 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">
                当前访问的是 GitHub Pages 镜像站，后台仅能在正式域名
                <code className="mx-1 font-mono text-text-primary">www.widget.power-knowledge.tech</code>
                登录。
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="adm-user" className="block text-xs font-medium text-text-secondary mb-1.5">
                用户名
              </label>
              <input
                id="adm-user"
                type="text"
                value={inputUser}
                onChange={(e) => setInputUser(e.target.value)}
                className="input-field"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label htmlFor="adm-pass" className="block text-xs font-medium text-text-secondary mb-1.5">
                密码
              </label>
              <input
                id="adm-pass"
                type="password"
                value={inputPass}
                onChange={(e) => setInputPass(e.target.value)}
                className="input-field"
                autoComplete="current-password"
                required
                autoFocus
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-md bg-danger/10 border border-danger/30 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn || crossOrigin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loggingIn ? '登录中…' : '登录'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── 已登录 ──
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2.5">
            <Inbox className="w-5 h-5 text-primary-light" />
            读者留言
          </h1>
          <p className="text-xs text-text-muted mt-1">
            已登录：<span className="font-mono text-text-secondary">{username}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load(filter)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary border border-border hover:text-text-primary hover:border-border-light disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary border border-border hover:text-primary-light hover:border-primary-light/50 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            设置
          </button>
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary border border-border hover:text-danger hover:border-danger/50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出
          </button>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key
          const n = counts[f.key]
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                active
                  ? 'bg-primary-dark/40 border-primary-light text-primary-light'
                  : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-border-light'
              }`}
            >
              {f.label}
              <span className="ml-1.5 tabular opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      {listError && (
        <div className="p-3 rounded-md bg-danger/10 border border-danger/30 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary">{listError}</p>
        </div>
      )}

      {/* 列表 */}
      {loading && !items.length ? (
        <div className="text-center py-16 text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
          <p className="text-sm">加载中…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Mail className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
          <p className="text-sm text-text-secondary">这里还没有留言。</p>
          <p className="text-xs text-text-muted mt-1.5">
            {filter === 'all' ? '读者提交后会出现在这里。' : '当前筛选条件下没有记录。'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <article
              key={m.id}
              className={`card-surface p-4 sm:p-5 ${
                m.status === 'new' ? 'border-l-2 border-l-primary-light' : ''
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary-dark/40 text-primary-light border border-primary-light/25">
                  {m.page}
                </span>
                {m.status === 'new' && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-accent/15 text-accent border border-accent/30">
                    未读
                  </span>
                )}
                {m.status === 'archived' && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-elevated text-text-muted border border-border">
                    已归档
                  </span>
                )}
                <span className="text-[11px] text-text-muted tabular ml-auto">
                  #{m.id} · {fmtDate(m.created_at)}
                </span>
              </div>

              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
                {m.content}
              </p>

              {m.contact && (
                <p className="text-xs text-text-secondary mt-3 pt-3 border-t border-border">
                  <span className="text-text-muted">联系方式：</span>
                  <span className="font-mono break-all">{m.contact}</span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-4">
                {m.status !== 'read' && (
                  <button
                    onClick={() => void handleStatus(m.id, 'read')}
                    disabled={busyId === m.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-text-secondary border border-border hover:text-primary-light hover:border-primary-light/50 disabled:opacity-40 transition-colors"
                  >
                    <MailCheck className="w-3.5 h-3.5" />
                    标记已读
                  </button>
                )}
                {m.status !== 'archived' && (
                  <button
                    onClick={() => void handleStatus(m.id, 'archived')}
                    disabled={busyId === m.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-text-secondary border border-border hover:text-text-primary hover:border-border-light disabled:opacity-40 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    归档
                  </button>
                )}
                {m.status === 'archived' && (
                  <button
                    onClick={() => void handleStatus(m.id, 'new')}
                    disabled={busyId === m.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-text-secondary border border-border hover:text-primary-light hover:border-primary-light/50 disabled:opacity-40 transition-colors"
                  >
                    <MailOpen className="w-3.5 h-3.5" />
                    取消归档
                  </button>
                )}
                <button
                  onClick={() => void handleDelete(m.id)}
                  disabled={busyId === m.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-text-secondary border border-border hover:text-danger hover:border-danger/50 disabled:opacity-40 transition-colors ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* 设置弹层：修改密码收纳在这里，不再常驻留言列表下方 */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
          onMouseDown={closeSettings}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="w-full max-w-md card-surface p-6 my-8 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 id="settings-title" className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary-light" />
                  设置
                </h2>
                <p className="text-[11px] text-text-muted mt-1">
                  已登录：<span className="font-mono text-text-secondary">{username}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeSettings}
                aria-label="关闭设置"
                className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
                <KeyRound className="w-4 h-4 text-primary-light" />
                修改密码
              </h3>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label htmlFor="pw-cur" className="block text-xs font-medium text-text-secondary mb-1.5">
                    当前密码
                  </label>
                  <input
                    id="pw-cur"
                    type="password"
                    value={curPass}
                    onChange={(e) => setCurPass(e.target.value)}
                    className="input-field"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="pw-new" className="block text-xs font-medium text-text-secondary mb-1.5">
                    新密码 <span className="text-text-muted font-normal">（至少 10 位）</span>
                  </label>
                  <input
                    id="pw-new"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="input-field"
                    autoComplete="new-password"
                    minLength={10}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="pw-cfm" className="block text-xs font-medium text-text-secondary mb-1.5">
                    确认新密码
                  </label>
                  <input
                    id="pw-cfm"
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="input-field"
                    autoComplete="new-password"
                    minLength={10}
                    required
                  />
                </div>

                {pwMsg && (
                  <div
                    className={`p-3 rounded-md border flex gap-2.5 ${
                      pwMsg.type === 'ok'
                        ? 'bg-success/10 border-success/30'
                        : 'bg-danger/10 border-danger/30'
                    }`}
                  >
                    <p className="text-xs text-text-secondary">{pwMsg.text}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={pwBusy}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {pwBusy ? '提交中…' : '更新密码'}
                  </button>
                  <button
                    type="button"
                    onClick={closeSettings}
                    className="px-4 py-2 rounded-md text-sm font-medium text-text-secondary border border-border hover:text-text-primary hover:border-border-light transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </form>

              <p className="text-[11px] text-text-muted mt-4 leading-relaxed">
                修改后，其它设备上的登录会立即失效，仅当前浏览器保持登录。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
