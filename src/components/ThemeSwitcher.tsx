import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * 页面风格切换器（8 套配色，2026-11-07 从 psu-model 的主题实现移植）。
 *
 * 设计要点：
 *   ① **只覆盖 CSS 变量**，不动结构。8 套主题在 index.css 里各是一个
 *      `html[data-theme="x"]{…}` 块，切换即改根元素上的 data-theme。
 *   ② **默认是本站原色**（深墨 teal），不写 data-theme 时就是它 ——
 *      所以「没选过」和「选了原色」视觉完全一致，不会因为加了换肤而改变老用户看到的画面。
 *   ③ **持久化用 localStorage**，键名 `pk-theme`；`?theme=` 优先于它，
 *      方便截图、分享某个具体风格（与 psu-model 同一套约定）。
 *   ④ **防首屏闪烁**靠 index.html 里的内联脚本 —— 它与本文件的 `readStoredTheme`
 *      保持同一套校验规则，必须在 CSS 之后、body 渲染之前执行。
 *      这里在 useEffect 里再同步一次，只为让按钮上的色点/名称对上。
 */

export const THEME_KEY = 'pk-theme'
export const DEFAULT_THEME = 'dark-teal'

export const THEMES = [
  { id: 'dark-teal', name: '深墨 teal', dot: '#14b8a6' },
  { id: 'blue', name: '蓝调浅色', dot: '#0070c0' },
  { id: 'navy-tech', name: '深蓝科技', dot: '#3aa0e8' },
  { id: 'graphite', name: '石墨灰', dot: '#3f4855' },
  { id: 'warm-paper', name: '米白手册', dot: '#9a5b13' },
  { id: 'forest', name: '森林墨绿', dot: '#3fbf7f' },
  { id: 'indigo', name: '靛紫柔光', dot: '#5b4bd6' },
  { id: 'sea-salt', name: '海盐青', dot: '#0e7490' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

function isThemeId(v: string | null): v is ThemeId {
  return !!v && THEMES.some((t) => t.id === v)
}

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME)
  const boxRef = useRef<HTMLDivElement>(null)

  // 首屏的 data-theme 已由 index.html 的内联脚本设好，这里只把 UI 状态对齐。
  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search).get('theme')
      const stored = localStorage.getItem(THEME_KEY)
      const id = isThemeId(q) ? q : isThemeId(stored) ? stored : DEFAULT_THEME
      setTheme(id)
      document.documentElement.dataset.theme = id
    } catch {
      /* 隐私模式下 localStorage 会抛错，退回默认即可 */
    }
  }, [])

  // 点击外部 / Esc 关闭菜单
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(id: ThemeId) {
    setTheme(id)
    document.documentElement.dataset.theme = id
    try {
      localStorage.setItem(THEME_KEY, id)
    } catch {
      /* 忽略写入失败 */
    }
    setOpen(false)
  }

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`页面风格：${current.name}`}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary sm:px-3"
      >
        {/* 色点直接取该主题的主色，切到哪一套一眼能对上 */}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: current.dot }}
          aria-hidden="true"
        />
        <span className="hidden md:inline">风格</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface py-1.5 shadow-2xl"
        >
          <p className="px-3 pt-1 pb-2 font-mono text-[10px] tracking-[0.1em] text-text-muted uppercase">
            页面风格 · {THEMES.length} 种（本机记住）
          </p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === theme}
              onClick={() => pick(t.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: t.dot }}
                aria-hidden="true"
              />
              <span className="flex-1 whitespace-nowrap">{t.name}</span>
              {t.id === theme && (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary-light" strokeWidth={2.5} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
